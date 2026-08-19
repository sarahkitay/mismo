import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
  ActivityEvent,
  AuditLogEntry,
  Prompt,
  PromptDelivery,
  PromptResponse,
  Report,
  ReportStatus,
  ReportStatusEvent,
  User,
  WageHourIntakeData,
  WageHourScreeningAcknowledgement,
} from '@/types';
import { allocateCaseReferenceNumber } from '@/lib/caseReference';
import { createIndustryChecklistForReport } from '@/lib/industryChecklistItems';
import {
  persistReport,
  persistReportChange,
  persistResponseThenReport,
} from '@/lib/supabase/writeOrgData';
import { notifyIncidentYes, notifyWageHourYes } from '@/lib/api/notifications';

export type ReportCaseDeps = {
  reports: Report[];
  prompts: Prompt[];
  users: User[];
  deliveries: PromptDelivery[];
  currentUser: User;
  effectiveOrgId: string;
  setReports: Dispatch<SetStateAction<Report[]>>;
  setActivities: Dispatch<SetStateAction<ActivityEvent[]>>;
  setAuditLogs: Dispatch<SetStateAction<AuditLogEntry[]>>;
  setReportStatusEvents: Dispatch<SetStateAction<ReportStatusEvent[]>>;
  setWageHourAcknowledgements: Dispatch<SetStateAction<WageHourScreeningAcknowledgement[]>>;
  setResponses: Dispatch<SetStateAction<PromptResponse[]>>;
  submitPromptResponse: (
    deliveryId: string,
    answer: PromptResponse['answer'],
    notes?: string,
    options?: { skipPersist?: boolean }
  ) => PromptResponse | undefined;
};

export function useReportCaseActions(deps: ReportCaseDeps) {
  const {
    reports,
    prompts,
    users,
    deliveries,
    currentUser,
    effectiveOrgId,
    setReports,
    setActivities,
    setAuditLogs,
    setReportStatusEvents,
    setWageHourAcknowledgements,
    setResponses,
    submitPromptResponse,
  } = deps;

 const beginIncidentCaseFromPrompt = useCallback(
 async (userId: string, delivery: PromptDelivery, response: PromptResponse) => {
 const existingCase = reports.find(
 (r) =>
 r.sourcePromptResponseId === response.id ||
 (r.sourcePromptId === delivery.promptId &&
 r.createdByUserId === userId &&
 r.reportSourceType === 'EMPLOYEE_PROMPT_RESPONSE' &&
 r.needsExtendedIncidentIntake)
 );
 if (existingCase) return existingCase;

 const now = new Date();
 const prompt = prompts.find((p) => p.id === delivery.promptId);
 const refNum = allocateCaseReferenceNumber(reports, effectiveOrgId, 'WORKPLACE_INVESTIGATION');
 const defaultAdmin = users.find((u) => u.role === 'HR' || u.role === 'ADMIN');
 const severity = prompt?.severityOnHasIssue ?? 'HIGH';
 const screeningNote = response.notes?.trim();
 const activityId = `activity-${Date.now()}`;
 const ledger: Report['handlingLedger'] = [
 {
 id: `ledger-${Date.now()}`,
 type: 'NOTE',
 text: 'Case opened from incident prompt Yes response.',
 createdAt: now,
 createdBy: userId,
 },
 ];
 if (screeningNote?.startsWith('Financial follow-up:')) {
 ledger.push({
 id: `ledger-${Date.now()}-fin`,
 type: 'NOTE',
 text: screeningNote,
 createdAt: now,
 createdBy: userId,
 });
 }
 const newReport: Report = {
 id: `report-${response.id}`,
 orgId: effectiveOrgId,
 createdByUserId: userId,
 isAnonymous: false,
 sourcePromptId: delivery.promptId,
 sourcePromptResponseId: response.id,
 reportSourceType: 'EMPLOYEE_PROMPT_RESPONSE',
 caseType: 'WORKPLACE_INVESTIGATION',
 referenceNumber: refNum,
 category: 'OTHER',
 severity,
 summary: 'Incident query - concern indicated',
 description:
 'Employee answered Yes on the mandatory incident query. Complete the secure intake form to provide details.',
 status: 'NEW',
 assignedTo: defaultAdmin?.id,
 needsExtendedIncidentIntake: true,
 messages: [],
 responseChecklist: createIndustryChecklistForReport(),
 handlingLedger: ledger,
 createdAt: now,
 updatedAt: now,
 };
 setReports((prev) => [newReport, ...prev]);
 setActivities((prev) => [
 {
 id: activityId,
 orgId: effectiveOrgId,
 type: 'REPORT_CREATED',
 actorUserId: userId,
 metadata: {
 reportId: newReport.id,
 source: 'EMPLOYEE_PROMPT_RESPONSE',
 promptResponseId: response.id,
 referenceNumber: refNum,
 },
 createdAt: now,
 },
 ...prev,
 ]);
 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'REPORT',
 recordId: newReport.id,
 field: 'caseType',
 oldValue: '',
 newValue: 'WORKPLACE_INVESTIGATION',
 actorUserId: userId,
 createdAt: now,
 reason: `Linked prompt response ${response.id}`,
 },
 ...prev,
 ]);
 const completedDelivery: PromptDelivery = {
 ...delivery,
 status: 'COMPLETED',
 completedAt: delivery.completedAt ?? now,
 updatedAt: now,
 };
 const persisted = await persistResponseThenReport(response, completedDelivery, newReport);
 if (!persisted.ok) {
 setReports((prev) => prev.filter((r) => r.id !== newReport.id));
 setActivities((prev) => prev.filter((a) => a.id !== activityId));
 throw new Error(persisted.message || 'Could not open incident case.');
 }
 return newReport;
 },
 [prompts, reports, effectiveOrgId, users]
 );

 /** Finalize incident prompt Yes: log response, open case shell, alert HR queue */
 const submitIncidentPromptYes = useCallback(
 async (deliveryId: string, notes?: string) => {
 const delivery = deliveries.find((d) => d.id === deliveryId);
 if (!delivery) return undefined;
 const response = submitPromptResponse(deliveryId, 'HAS_ISSUE', notes, { skipPersist: true });
 if (!response) return undefined;
 const report = await beginIncidentCaseFromPrompt(delivery.userId, delivery, response);
 const employee = users.find((u) => u.id === delivery.userId);
 if (employee?.email) {
 void notifyIncidentYes({
 employeeEmail: employee.email,
 orgId: effectiveOrgId,
 caseId: report.id,
 employeeUserId: delivery.userId,
 });
 }
 return { response, report };
 },
 [deliveries, submitPromptResponse, beginIncidentCaseFromPrompt, users, effectiveOrgId]
 );
 
 // Create report — only succeeds when the database insert succeeds.
 const createReport = useCallback(async (reportData: Omit<Report, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'status'>) => {
 const now = new Date();
 
 const needsExtended = Boolean(reportData.needsExtendedIncidentIntake);
 const caseType = reportData.caseType ?? (reportData.category === 'WAGE_HOURS' ? 'WAGE_HOUR' : 'WORKPLACE_INVESTIGATION');
 const refNum =
 reportData.referenceNumber ??
 allocateCaseReferenceNumber(reports, effectiveOrgId, caseType);
 const defaultAdmin = users.find((u) => u.role === 'HR' || u.role === 'ADMIN');
 const newReport: Report = {
 ...reportData,
 id: `report-${Date.now()}`,
 orgId: effectiveOrgId,
 caseType,
 referenceNumber: refNum,
 status: 'NEW',
 assignedTo: reportData.assignedTo ?? defaultAdmin?.id,
 needsExtendedIncidentIntake: needsExtended,
 incidentIntakeCompletedAt: needsExtended ? undefined : now,
 messages: reportData.messages ?? [],
 responseChecklist: reportData.responseChecklist ?? createIndustryChecklistForReport(),
 handlingLedger: reportData.handlingLedger ?? [
 {
 id: `ledger-${Date.now()}`,
 type: 'NOTE',
 text: 'Case intake recorded in HR command log.',
 createdAt: now,
 createdBy: reportData.createdByUserId,
 },
 ],
 createdAt: now,
 updatedAt: now,
 };
 
 setReports(prev => [newReport, ...prev]);
 
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'REPORT_CREATED',
 actorUserId: reportData.createdByUserId,
 metadata: { reportId: newReport.id, category: reportData.category, referenceNumber: refNum },
 createdAt: now,
 };
 setActivities(prev => [newActivity, ...prev]);

 const persisted = await persistReport(newReport);
 if (!persisted.ok) {
 setReports((prev) => prev.filter((r) => r.id !== newReport.id));
 setActivities((prev) => prev.filter((a) => a.id !== newActivity.id));
 throw new Error(persisted.message || 'Could not save report.');
 }

 return newReport;
 }, [effectiveOrgId, reports, users]);

 const recordWageHourScreeningNo = useCallback(
 (userId: string) => {
 const now = new Date();
 const ack: WageHourScreeningAcknowledgement = {
 id: `wh-ack-${Date.now()}`,
 orgId: effectiveOrgId,
 userId,
 hasConcern: false,
 acknowledgedAt: now,
 };
 setWageHourAcknowledgements((prev) => [...prev, ack]);
 setActivities((prev) => [
 {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'WAGE_HOUR_SCREENING',
 actorUserId: userId,
 metadata: { hasConcern: false, acknowledgementId: ack.id },
 createdAt: now,
 },
 ...prev,
 ]);
 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'WAGE_HOUR_SCREENING',
 recordId: ack.id,
 field: 'hasConcern',
 oldValue: '',
 newValue: 'false',
 actorUserId: userId,
 createdAt: now,
 },
 ...prev,
 ]);
 return ack;
 },
 [effectiveOrgId]
 );

 const beginWageHourCase = useCallback(
 async (userId: string, sourceType: Report['reportSourceType'] = 'SELF_REPORTED') => {
 const now = new Date();
 const refNum = allocateCaseReferenceNumber(reports, effectiveOrgId, 'WAGE_HOUR');
 const defaultAdmin = users.find((u) => u.role === 'HR' || u.role === 'ADMIN');
 const newReport: Report = {
 id: `report-${Date.now()}`,
 orgId: effectiveOrgId,
 createdByUserId: userId,
 isAnonymous: false,
 reportSourceType: sourceType,
 caseType: 'WAGE_HOUR',
 referenceNumber: refNum,
 category: 'WAGE_HOURS',
 severity: 'MEDIUM',
 summary: 'Wage & Hour Concern',
 description: 'Protected wage and hour concern - complete intake to submit details.',
 status: 'PENDING_WAGE_HOUR_REVIEW',
 assignedTo: defaultAdmin?.id,
 needsExtendedWageHourIntake: true,
 messages: [],
 responseChecklist: createIndustryChecklistForReport(),
 handlingLedger: [
 {
 id: `ledger-${Date.now()}`,
 type: 'NOTE',
 text: 'Protected wage & hour case opened from employee portal screening.',
 createdAt: now,
 createdBy: userId,
 },
 ],
 createdAt: now,
 updatedAt: now,
 };
 setReports((prev) => [newReport, ...prev]);
 const activityId = `activity-${Date.now()}`;
 setActivities((prev) => [
 {
 id: activityId,
 orgId: effectiveOrgId,
 type: 'WAGE_HOUR_SCREENING',
 actorUserId: userId,
 metadata: { hasConcern: true, reportId: newReport.id, referenceNumber: refNum, alert: 'CLIENT_ADMIN' },
 createdAt: now,
 },
 ...prev,
 ]);
 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'REPORT',
 recordId: newReport.id,
 field: 'caseType',
 oldValue: '',
 newValue: 'WAGE_HOUR',
 actorUserId: userId,
 createdAt: now,
 },
 ...prev,
 ]);
 const persisted = await persistReport(newReport);
 if (!persisted.ok) {
 setReports((prev) => prev.filter((r) => r.id !== newReport.id));
 setActivities((prev) => prev.filter((a) => a.id !== activityId));
 throw new Error(persisted.message || 'Could not open wage & hour case.');
 }
 const employee = users.find((u) => u.id === userId);
 if (employee?.email) {
 void notifyWageHourYes({
 employeeEmail: employee.email,
 orgId: effectiveOrgId,
 caseId: newReport.id,
 referenceNumber: refNum,
 employeeUserId: userId,
 });
 }
 return newReport;
 },
 [effectiveOrgId, reports, users]
 );

 const completeWageHourIntake = useCallback(
 async (reportId: string, intake: WageHourIntakeData) => {
 const now = new Date();
 const existing = reports.find((r) => r.id === reportId);
 if (!existing) throw new Error('Case not found.');
 const submitted: WageHourIntakeData = { ...intake, submittedAt: now };
 const updated: Report = {
 ...existing,
 wageHourIntake: submitted,
 needsExtendedWageHourIntake: false,
 wageHourIntakeCompletedAt: now,
 status: 'PENDING_WAGE_HOUR_REVIEW',
 description: intake.concernDescription,
 summary: `Wage & Hour: ${intake.issueTypes.map((t) => t.replace(/_/g, ' ')).join(', ')}`,
 updatedAt: now,
 handlingLedger: [
 ...(existing.handlingLedger ?? []),
 {
 id: `ledger-${Date.now()}`,
 type: 'NOTE',
 text: 'Employee completed wage & hour intake form.',
 createdAt: now,
 createdBy: existing.createdByUserId,
 },
 ],
 };
 setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
 setActivities((prev) => [
 {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'WAGE_HOUR_SUBMITTED',
 actorUserId: existing.createdByUserId,
 metadata: { reportId, referenceNumber: existing.referenceNumber },
 createdAt: now,
 },
 ...prev,
 ]);
 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'REPORT',
 recordId: reportId,
 field: 'wageHourIntake',
 oldValue: 'draft',
 newValue: 'submitted',
 actorUserId: existing.createdByUserId ?? currentUser.id,
 createdAt: now,
 },
 ...prev,
 ]);
 const persisted = await persistReportChange(updated);
 if (!persisted.ok) {
 setReports((prev) => prev.map((r) => (r.id === reportId ? existing : r)));
 throw new Error(persisted.message || 'Could not save wage & hour intake.');
 }
 return updated;
 },
 [reports, currentUser.id, effectiveOrgId]
 );

 /** Payroll memo only: quick flag with no employee details - skips triage, 24h admin SLA. */
 const submitExpeditedPayrollReport = useCallback(
 async (
 userId: string,
 opts?: {
 deliveryId?: string;
 promptId?: string;
 promptNotes?: string;
 sourceType?: Report['reportSourceType'];
 }
 ) => {
 const now = new Date();
 const slaDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);
 const refNum = allocateCaseReferenceNumber(reports, effectiveOrgId, 'WAGE_HOUR');
 const defaultAdmin = users.find((u) => u.role === 'ADMIN' || u.role === 'HR');

 let responseId: string | undefined;
 let linkedResponse: PromptResponse | undefined;
 let linkedDelivery: PromptDelivery | undefined;
 if (opts?.deliveryId) {
 const delivery = deliveries.find((d) => d.id === opts.deliveryId);
 if (delivery) {
 const note =
 opts.promptNotes ??
 'Payroll memo: employee reported a payroll issue with no additional details (expedited 24h path).';
 // Defer persist so report FK waits on the response row.
 const response = submitPromptResponse(delivery.id, 'HAS_ISSUE', note, { skipPersist: true });
 responseId = response?.id;
 linkedResponse = response;
 linkedDelivery = delivery;
 if (responseId) {
 setResponses((prev) =>
 prev.map((r) =>
 r.id === responseId
 ? { ...r, needsReview: false, reviewedAt: now }
 : r
 )
 );
 if (linkedResponse) {
 linkedResponse = { ...linkedResponse, needsReview: false, reviewedAt: now };
 }
 }
 }
 }

 const intakeNote =
 'Employee reported a payroll issue through the expedited payroll memo path. No additional details were provided. Administrator must review and resolve within 24 hours.';

 const activityId = `activity-${Date.now()}`;
 const newReport: Report = {
 id: `report-${Date.now()}`,
 orgId: effectiveOrgId,
 createdByUserId: userId,
 isAnonymous: false,
 sourcePromptId: opts?.promptId,
 sourcePromptResponseId: responseId,
 reportSourceType: opts?.sourceType ?? 'WAGE_HOUR_PROMPT',
 caseType: 'WAGE_HOUR',
 referenceNumber: refNum,
 category: 'WAGE_HOURS',
 severity: 'HIGH',
 summary: 'Payroll issue - expedited (no details)',
 description: intakeNote,
 status: 'PAYROLL_EXPEDITED',
 assignedTo: defaultAdmin?.id,
 expeditedPayroll: true,
 payrollSlaDueAt: slaDue,
 needsExtendedWageHourIntake: false,
 wageHourIntakeCompletedAt: now,
 wageHourIntake: {
 issueTypes: ['OTHER'],
 concernDescription: intakeNote,
 submittedAt: now,
 },
 handlingLedger: [
 {
 id: `ledger-${Date.now()}`,
 type: 'NOTE',
 text: 'Expedited payroll memo submitted. Routed directly to administrator - triage skipped. 24-hour resolution SLA.',
 createdAt: now,
 createdBy: userId,
 },
 ],
 createdAt: now,
 updatedAt: now,
 };

 setReports((prev) => [newReport, ...prev]);
 setActivities((prev) => [
 {
 id: activityId,
 orgId: effectiveOrgId,
 type: 'PAYROLL_EXPEDITED',
 actorUserId: userId,
 metadata: {
 reportId: newReport.id,
 referenceNumber: refNum,
 payrollSlaDueAt: slaDue.toISOString(),
 alert: 'ADMIN_24H',
 },
 createdAt: now,
 },
 ...prev,
 ]);
 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'REPORT',
 recordId: newReport.id,
 field: 'status',
 oldValue: '',
 newValue: 'PAYROLL_EXPEDITED',
 actorUserId: userId,
 createdAt: now,
 reason: 'Expedited payroll memo - no triage',
 },
 ...prev,
 ]);

 let persistedOk = false;
 if (linkedResponse && linkedDelivery) {
 const completedDelivery: PromptDelivery = {
 ...linkedDelivery,
 status: 'COMPLETED',
 completedAt: linkedDelivery.completedAt ?? now,
 updatedAt: now,
 };
 const result = await persistResponseThenReport(linkedResponse, completedDelivery, newReport);
 persistedOk = result.ok;
 } else {
 const persisted = await persistReport(newReport);
 persistedOk = persisted.ok;
 }

 if (!persistedOk) {
 setReports((prev) => prev.filter((r) => r.id !== newReport.id));
 setActivities((prev) => prev.filter((a) => a.id !== activityId));
 throw new Error('Could not save expedited payroll report.');
 }

 return newReport;
 },
 [effectiveOrgId, reports, users, deliveries, submitPromptResponse]
 );
 
 // Update report status
 const updateReportStatus = useCallback((
 reportId: string,
 newStatus: ReportStatus,
 _note?: string,
 assignedTo?: string
 ) => {
 const report = reports.find(r => r.id === reportId);
 if (!report) return;
 
 const now = new Date();
 const oldStatus = report.status;

 const updatedReport: Report = {
 ...report,
 status: newStatus,
 assignedTo: assignedTo || report.assignedTo,
 updatedAt: now,
 };
 setReports(prev => prev.map(r => (r.id === reportId ? updatedReport : r)));

 // Add activity event
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'REPORT_STATUS_CHANGED',
 actorUserId: currentUser.id,
 metadata: { reportId, from: oldStatus, to: newStatus },
 createdAt: now,
 };
 
 setActivities(prev => [newActivity, ...prev]);
 const statusEvent: ReportStatusEvent = {
 id: `status-event-${Date.now()}`,
 orgId: effectiveOrgId,
 reportId,
 fromStatus: oldStatus,
 toStatus: newStatus,
 changedBy: currentUser.id,
 note: _note,
 createdAt: now,
 updatedAt: now,
 };
 setReportStatusEvents((prev) => [statusEvent, ...prev]);
 void persistReportChange(updatedReport, statusEvent);
 }, [reports, currentUser.id, effectiveOrgId]);
 
 // Assign report
 const assignReport = useCallback((reportId: string, adminId: string) => {
 const report = reports.find(r => r.id === reportId);
 if (!report) return;
 
 const now = new Date();

 const updatedReport: Report = {
 ...report,
 assignedTo: adminId,
 status: 'ASSIGNED',
 updatedAt: now,
 };
 setReports(prev => prev.map(r => (r.id === reportId ? updatedReport : r)));

 // Add activity event
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'REPORT_ASSIGNED',
 actorUserId: currentUser.id,
 metadata: { reportId, assignedTo: adminId },
 createdAt: now,
 };
 
 setActivities(prev => [newActivity, ...prev]);
 let statusEvent: ReportStatusEvent | undefined;
 if (report.status !== 'ASSIGNED') {
 statusEvent = {
 id: `status-event-${Date.now()}`,
 orgId: effectiveOrgId,
 reportId,
 fromStatus: report.status,
 toStatus: 'ASSIGNED',
 changedBy: currentUser.id,
 note: `Assigned to ${adminId}`,
 createdAt: now,
 updatedAt: now,
 };
 setReportStatusEvents((prev) => [statusEvent!, ...prev]);
 }
 void persistReportChange(updatedReport, statusEvent);
 }, [reports, currentUser.id, effectiveOrgId]);

 const completeIncidentIntake = useCallback(
 async (
 reportId: string,
 payload: { description: string; peopleInvolved?: string; location?: string }
 ) => {
 const report = reports.find((r) => r.id === reportId);
 if (!report || report.createdByUserId !== currentUser.id) {
 throw new Error('Report not found.');
 }
 const now = new Date();
 const updated: Report = {
 ...report,
 description: payload.description,
 peopleInvolved: payload.peopleInvolved ?? report.peopleInvolved,
 location: payload.location ?? report.location,
 needsExtendedIncidentIntake: false,
 incidentIntakeCompletedAt: now,
 updatedAt: now,
 };
 setReports((prev) => prev.map((r) => (r.id === reportId ? updated : r)));
 const activityId = `activity-${Date.now()}`;
 setActivities((prev) => [
 {
 id: activityId,
 orgId: effectiveOrgId,
 type: 'REPORT_STATUS_CHANGED',
 actorUserId: currentUser.id,
 metadata: { reportId, action: 'INCIDENT_INTAKE_COMPLETED' },
 createdAt: now,
 },
 ...prev,
 ]);
 const persisted = await persistReportChange(updated);
 if (!persisted.ok) {
 setReports((prev) => prev.map((r) => (r.id === reportId ? report : r)));
 setActivities((prev) => prev.filter((a) => a.id !== activityId));
 throw new Error(persisted.message || 'Could not save incident form.');
 }
 return updated;
 },
 [reports, currentUser.id, effectiveOrgId]
 );
 


  return {
    beginIncidentCaseFromPrompt,
    submitIncidentPromptYes,
    createReport,
    recordWageHourScreeningNo,
    beginWageHourCase,
    completeWageHourIntake,
    submitExpeditedPayrollReport,
    updateReportStatus,
    assignReport,
    completeIncidentIntake,
  };
}
