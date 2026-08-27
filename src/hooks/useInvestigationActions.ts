import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type {
 ActivityEvent,
 AuditLogEntry,
 Investigation,
 InvestigationAttachment,
 InvestigationChecklistStage,
 InvestigationCorrectiveAction,
 InvestigationEmployeeContactPreference,
 InvestigationEvidenceRecord,
 InvestigationFollowUp,
 InvestigationNote,
 InvestigationNoteType,
 InvestigationPerson,
 InvestigationPriority,
 InvestigationResponseRequest,
 InvestigationStage,
 OutcomeClassification,
 Prompt,
 Report,
 User,
} from '@/types';
import {
 buildDefaultChecklistStages,
 buildStageHistoryEntry,
 inferReportSourceType,
} from '@/lib/investigationWorkflow';
import { allocateCaseReferenceNumber } from '@/lib/caseReference';
import { persistInvestigation, persistReportChange } from '@/lib/supabase/writeOrgData';
import { saveInvestigationWorkspace } from '@/lib/investigationWorkspacePersistence';
import { flushInvestigationDrafts } from '@/lib/investigationDraftRegistry';
import { createIndustryChecklistForReport } from '@/lib/industryChecklistItems';
import { canCloseInvestigation } from '@/lib/investigationOutcome';

export type InvestigationActionDeps = {
 reports: Report[];
 prompts: Prompt[];
 investigations: Investigation[];
 currentUser: User;
 effectiveOrgId: string;
 setInvestigations: Dispatch<SetStateAction<Investigation[]>>;
 setReports: Dispatch<SetStateAction<Report[]>>;
 setActivities: Dispatch<SetStateAction<ActivityEvent[]>>;
 setAuditLogs: Dispatch<SetStateAction<AuditLogEntry[]>>;
};

export function useInvestigationActions(deps: InvestigationActionDeps) {
 const {
 reports,
 prompts,
 investigations,
 currentUser,
 effectiveOrgId,
 setInvestigations,
 setReports,
 setActivities,
 setAuditLogs,
 } = deps;

 // Create investigation
 const createInvestigation = useCallback((reportId: string, ownerId: string) => {
 const report = reports.find(r => r.id === reportId);
 if (!report) return;
 
 const now = new Date();
 
 const refNum =
 report.referenceNumber ??
 allocateCaseReferenceNumber(reports, report.orgId, report.caseType ?? 'WORKPLACE_INVESTIGATION');
 const prompt = report.sourcePromptId ? prompts.find((p) => p.id === report.sourcePromptId) : undefined;
 const sourceType = inferReportSourceType(report, prompt);
 const priority: InvestigationPriority =
 report.severity === 'CRITICAL' ? 'CRITICAL' : report.severity === 'HIGH' ? 'HIGH' : report.severity === 'MEDIUM' ? 'MEDIUM' : 'LOW';
 const stageHistory = [
 buildStageHistoryEntry('INTAKE_RECEIVED', currentUser.id, ownerId, 'Investigation shell created from linked report'),
 buildStageHistoryEntry('PENDING_REVIEW', currentUser.id, ownerId),
 ];
 const newInvestigation: Investigation = {
 id: `inv-${Date.now()}`,
 orgId: effectiveOrgId,
 referenceNumber: refNum,
 status: 'OPEN',
 ownerId,
 linkedReportIds: [reportId],
 category: report.category,
 severity: report.severity,
 priority,
 riskLevel: report.severity === 'CRITICAL' || report.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
 reportSourceType: sourceType,
 linkedPromptId: report.sourcePromptId,
 linkedPromptResponseId: report.sourcePromptResponseId,
 openedAt: now,
 lastUpdateAt: now,
 createdAt: now,
 updatedAt: now,
 workflowPhase: 'QUEUED',
 stage: 'PENDING_REVIEW',
 stageHistory,
 checklistStages: buildDefaultChecklistStages(),
 subjectUserIds:
 report.createdByUserId && !report.isAnonymous ? [report.createdByUserId] : [],
 persons: [],
 notes: [],
 workflowPagesCompleted: { intake: false, gathering: false, outcome: false },
 };
 
 setInvestigations(prev => [...prev, newInvestigation]);
 
 const checklist = (report.responseChecklist ?? []).length > 0 ? report.responseChecklist : createIndustryChecklistForReport();
 const updatedReport: Report = {
 ...report,
 investigationId: newInvestigation.id,
 referenceNumber: report.referenceNumber ?? refNum,
 responseChecklist: checklist,
 updatedAt: now,
 };
 setReports(prev => prev.map(r => (r.id === reportId ? updatedReport : r)));

 void persistInvestigation(newInvestigation);
 void persistReportChange(updatedReport);
 
 // Add activity event
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_CREATED',
 actorUserId: currentUser.id,
 metadata: { investigationId: newInvestigation.id, reportId },
 createdAt: now,
 };
 
 setActivities(prev => [newActivity, ...prev]);

 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}-inv`,
 orgId: effectiveOrgId,
 recordType: 'INVESTIGATION',
 recordId: newInvestigation.id,
 field: 'status',
 oldValue: '',
 newValue: 'OPEN',
 actorUserId: currentUser.id,
 createdAt: now,
 reason: `Investigation created from report ${reportId}`,
 },
 {
 id: `audit-${Date.now()}-report`,
 orgId: effectiveOrgId,
 recordType: 'REPORT',
 recordId: reportId,
 field: 'investigationId',
 oldValue: '',
 newValue: newInvestigation.id,
 actorUserId: currentUser.id,
 createdAt: now,
 },
 ...prev,
 ]);
 
 return newInvestigation;
 }, [reports, investigations, currentUser.id]);

 const saveInvestigationProgress = useCallback((investigationId: string) => {
 flushInvestigationDrafts(investigationId);
 setInvestigations((prev) => {
 const inv = prev.find((i) => i.id === investigationId);
 if (!inv) return prev;
 const next = { ...inv, updatedAt: new Date(), lastUpdateAt: new Date() };
 saveInvestigationWorkspace(next);
 void persistInvestigation(next);
 return prev.map((i) => (i.id === investigationId ? next : i));
 });
 }, []);

 const appendInvestigationAudit = useCallback(
 (investigationId: string, field: string, oldValue: string, newValue: string, reason?: string) => {
 const entry: AuditLogEntry = {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'INVESTIGATION',
 recordId: investigationId,
 field,
 oldValue,
 newValue,
 actorUserId: currentUser.id,
 createdAt: new Date(),
 reason,
 };
 setAuditLogs((prev) => [entry, ...prev]);
 },
 [currentUser.id]
 );

 const advanceInvestigationStage = useCallback(
 (investigationId: string, stage: InvestigationStage, note?: string) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) => {
 if (inv.id !== investigationId) return inv;
 const history = [...(inv.stageHistory ?? []), buildStageHistoryEntry(stage, currentUser.id, inv.ownerId, note)];
 return {
 ...inv,
 stage,
 stageHistory: history,
 lastUpdateAt: now,
 updatedAt: now,
 workflowPhase:
 stage === 'IN_PROGRESS' || stage === 'EMPLOYEE_FOLLOW_UP' || stage === 'EVIDENCE_REVIEW'
 ? 'IN_PROGRESS'
 : stage === 'OUTCOME_PENDING'
 ? 'AWAITING_OUTCOME_ACK'
 : inv.workflowPhase,
 };
 })
 );
 appendInvestigationAudit(investigationId, 'stage', '', stage, note);
 },
 [currentUser.id, appendInvestigationAudit]
 );

 const assignInvestigationOwner = useCallback(
 (investigationId: string, ownerId: string) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 ownerId,
 stage: inv.stage === 'PENDING_REVIEW' || !inv.stage ? 'ASSIGNED' : inv.stage,
 stageHistory: [
 ...(inv.stageHistory ?? []),
 buildStageHistoryEntry('ASSIGNED', currentUser.id, ownerId, 'Lead investigator assigned'),
 ],
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 appendInvestigationAudit(investigationId, 'ownerId', '', ownerId);
 },
 [currentUser.id, appendInvestigationAudit]
 );

 const setInvestigationPersons = useCallback((investigationId: string, persons: InvestigationPerson[]) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId ? { ...inv, persons, lastUpdateAt: now, updatedAt: now } : inv
 )
 );
 }, []);

 const updateInvestigationChecklist = useCallback(
 (investigationId: string, stages: InvestigationChecklistStage[]) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId ? { ...inv, checklistStages: stages, lastUpdateAt: now, updatedAt: now } : inv
 )
 );
 },
 []
 );

 const addInvestigationEvidence = useCallback(
 (investigationId: string, record: Omit<InvestigationEvidenceRecord, 'id' | 'uploadedAt' | 'uploadedByUserId' | 'preserved'>) => {
 const now = new Date();
 const entry: InvestigationEvidenceRecord = {
 ...record,
 id: `ev-${Date.now()}`,
 uploadedAt: now,
 uploadedByUserId: currentUser.id,
 preserved: true,
 };
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? { ...inv, evidenceRecords: [...(inv.evidenceRecords ?? []), entry], lastUpdateAt: now, updatedAt: now }
 : inv
 )
 );
 appendInvestigationAudit(investigationId, 'evidence', '', entry.fileName, 'Evidence uploaded');
 return entry;
 },
 [currentUser.id, appendInvestigationAudit]
 );

 const addInvestigationResponseRequest = useCallback(
 (investigationId: string, payload: Omit<InvestigationResponseRequest, 'id' | 'createdAt' | 'createdByUserId' | 'status'>) => {
 const now = new Date();
 const req: InvestigationResponseRequest = {
 ...payload,
 id: `req-${Date.now()}`,
 status: payload.sentAt ? 'SENT' : 'DRAFT',
 createdAt: now,
 createdByUserId: currentUser.id,
 };
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 responseRequests: [...(inv.responseRequests ?? []), req],
 stage: inv.stage === 'IN_PROGRESS' ? 'EMPLOYEE_FOLLOW_UP' : inv.stage,
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 appendInvestigationAudit(investigationId, 'responseRequest', '', req.id, 'Response request created');
 return req;
 },
 [currentUser.id, appendInvestigationAudit]
 );

 const updateInvestigationResponseRequest = useCallback(
 (investigationId: string, requestId: string, patch: Partial<InvestigationResponseRequest>) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 responseRequests: (inv.responseRequests ?? []).map((r) => (r.id === requestId ? { ...r, ...patch } : r)),
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 },
 []
 );

 const submitEmployeeInvestigationResponse = useCallback(
 (investigationId: string, requestId: string, responseText: string) => {
 const inv = investigations.find((i) => i.id === investigationId);
 const req = inv?.responseRequests?.find((r) => r.id === requestId);
 if (!inv || !req || req.partyUserId !== currentUser.id) return false;
 const trimmed = responseText.trim();
 if (!trimmed) return false;
 const now = new Date();
 updateInvestigationResponseRequest(investigationId, requestId, {
 status: 'SUBMITTED',
 submittedAt: now,
 viewedAt: req.viewedAt ?? now,
 responseText: trimmed,
 });
 setActivities((prev) => [
 {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_UPDATED',
 actorUserId: currentUser.id,
 metadata: { investigationId, requestId, action: 'EMPLOYEE_RESPONSE_SUBMITTED' },
 createdAt: now,
 },
 ...prev,
 ]);
 setAuditLogs((prev) => [
 {
 id: `audit-${Date.now()}`,
 orgId: effectiveOrgId,
 recordType: 'INVESTIGATION',
 recordId: investigationId,
 field: 'responseRequest',
 oldValue: req.status,
 newValue: 'SUBMITTED',
 actorUserId: currentUser.id,
 createdAt: now,
 reason: `Employee response on request ${requestId}`,
 },
 ...prev,
 ]);
 return true;
 },
 [investigations, currentUser.id, updateInvestigationResponseRequest]
 );

 const updateInvestigationAnalysis = useCallback(
 (
 investigationId: string,
 patch: {
 findingsRationale?: string;
 policyAnalysisNotes?: string;
 linkedPolicyIds?: string[];
 finalFindingsReport?: string;
 legalInvolved?: boolean;
 legalInvolvementNotes?: string;
 }
 ) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) => (inv.id === investigationId ? { ...inv, ...patch, lastUpdateAt: now, updatedAt: now } : inv))
 );
 },
 []
 );

 const addCorrectiveAction = useCallback(
 (investigationId: string, payload: Omit<InvestigationCorrectiveAction, 'id' | 'createdAt' | 'createdByUserId' | 'status'>) => {
 const now = new Date();
 const action: InvestigationCorrectiveAction = {
 ...payload,
 id: `ca-${Date.now()}`,
 status: 'PENDING',
 createdAt: now,
 createdByUserId: currentUser.id,
 };
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? { ...inv, correctiveActions: [...(inv.correctiveActions ?? []), action], lastUpdateAt: now, updatedAt: now }
 : inv
 )
 );
 return action;
 },
 [currentUser.id]
 );

 const updateCorrectiveAction = useCallback(
 (investigationId: string, actionId: string, patch: Partial<InvestigationCorrectiveAction>) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 correctiveActions: (inv.correctiveActions ?? []).map((a) =>
 a.id === actionId ? { ...a, ...patch, completedAt: patch.status === 'COMPLETE' ? now : a.completedAt } : a
 ),
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 },
 []
 );

 const addFollowUp = useCallback(
 (investigationId: string, payload: Omit<InvestigationFollowUp, 'id' | 'createdAt' | 'status'>) => {
 const now = new Date();
 const followUp: InvestigationFollowUp = {
 ...payload,
 id: `fu-${Date.now()}`,
 status: 'SCHEDULED',
 createdAt: now,
 };
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? { ...inv, followUps: [...(inv.followUps ?? []), followUp], lastUpdateAt: now, updatedAt: now }
 : inv
 )
 );
 return followUp;
 },
 []
 );

 const completeFollowUp = useCallback(
 (investigationId: string, followUpId: string, notes?: string, concernLogged?: boolean) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 followUps: (inv.followUps ?? []).map((f) =>
 f.id === followUpId ? { ...f, status: 'COMPLETE', completedAt: now, notes, concernLogged } : f
 ),
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 },
 []
 );

 const sendNonRetaliationReminder = useCallback(
 (investigationId: string) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId ? { ...inv, nonRetaliationSentAt: now, lastUpdateAt: now, updatedAt: now } : inv
 )
 );
 appendInvestigationAudit(investigationId, 'nonRetaliation', '', 'sent', 'Non-retaliation reminder auto-sent');
 },
 [appendInvestigationAudit]
 );

 const setInvestigationOutcomeClassification = useCallback(
 (investigationId: string, classification: OutcomeClassification) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId ? { ...inv, outcomeClassification: classification, lastUpdateAt: now, updatedAt: now } : inv
 )
 );
 },
 []
 );

 const pickUpInvestigation = useCallback(
 (investigationId: string, preferred: InvestigationEmployeeContactPreference) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 workflowPhase: 'IN_PROGRESS',
 stage: 'IN_PROGRESS',
 pickedUpAt: now,
 employeePreferredContact: preferred,
 ownerId: currentUser.id,
 stageHistory: [
 ...(inv.stageHistory ?? []),
 buildStageHistoryEntry('IN_PROGRESS', currentUser.id, currentUser.id, 'Investigator opened case'),
 ],
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_UPDATED',
 actorUserId: currentUser.id,
 metadata: { investigationId, action: 'PICKED_UP' },
 createdAt: now,
 };
 setActivities((prev) => [newActivity, ...prev]);
 },
 [currentUser.id]
 );

 const setInvestigationInitialContactNotes = useCallback((investigationId: string, notes: string) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId ? { ...inv, initialContactNotes: notes, lastUpdateAt: now, updatedAt: now } : inv
 )
 );
 }, []);

 const saveInvestigationInitialContact = useCallback((investigationId: string) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? { ...inv, initialContactSavedAt: now, lastUpdateAt: now, updatedAt: now }
 : inv
 )
 );
 }, []);

 const unlockInvestigationInitialContact = useCallback((investigationId: string) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? { ...inv, initialContactSavedAt: undefined, lastUpdateAt: now, updatedAt: now }
 : inv
 )
 );
 }, []);

 const addInitialContactAttachment = useCallback(
 (investigationId: string, attachment: InvestigationAttachment) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 initialContactAttachments: [...(inv.initialContactAttachments ?? []), attachment],
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 },
 []
 );

 const removeInitialContactAttachment = useCallback((investigationId: string, attachmentId: string) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 initialContactAttachments: (inv.initialContactAttachments ?? []).filter((a) => a.id !== attachmentId),
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 }, []);

 const markInvestigationPageComplete = useCallback(
 (investigationId: string, page: 'intake' | 'gathering' | 'outcome') => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) => {
 if (inv.id !== investigationId) return inv;
 const completed = { ...(inv.workflowPagesCompleted ?? {}), [page]: true };
 return { ...inv, workflowPagesCompleted: completed, lastUpdateAt: now, updatedAt: now };
 })
 );
 },
 []
 );

 const setInvestigationSubjectUsers = useCallback((investigationId: string, subjectUserIds: string[]) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId ? { ...inv, subjectUserIds, lastUpdateAt: now, updatedAt: now } : inv
 )
 );
 }, []);

 const addInvestigationNote = useCallback(
 (
 investigationId: string,
 payload: {
 visibility: InvestigationNote['visibility'];
 body: string;
 attachments?: InvestigationAttachment[];
 requiresEmployeeSignature?: boolean;
 noteType?: InvestigationNoteType;
 taggedUserIds?: string[];
 }
 ) => {
 const now = new Date();
 const note: InvestigationNote = {
 id: `inv-note-${Date.now()}`,
 visibility: payload.visibility,
 body: payload.body,
 createdAt: now,
 createdByUserId: currentUser.id,
 attachments: payload.attachments,
 requiresEmployeeSignature: payload.requiresEmployeeSignature,
 noteType: payload.noteType,
 taggedUserIds: payload.taggedUserIds,
 sentAt: payload.visibility === 'EMPLOYEE' ? now : undefined,
 };
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? { ...inv, notes: [...(inv.notes ?? []), note], lastUpdateAt: now, updatedAt: now }
 : inv
 )
 );
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_UPDATED',
 actorUserId: currentUser.id,
 metadata: { investigationId, noteId: note.id },
 createdAt: now,
 };
 setActivities((prev) => [newActivity, ...prev]);
 },
 [currentUser.id]
 );

 const sendInvestigationOutcomeToEmployee = useCallback(
 (
 investigationId: string,
 payload: {
 summary: string;
 requiresSignature: boolean;
 attachment?: InvestigationAttachment;
 }
 ) => {
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((inv) =>
 inv.id === investigationId
 ? {
 ...inv,
 outcomeSummary: payload.summary,
 outcomeRequiresSignature: payload.requiresSignature,
 outcomeAttachment: payload.attachment,
 outcomeSentAt: now,
 outcomeEmployeeAgreed: null,
 outcomeEmployeeSignedAt: undefined,
 outcomeEmployeeSignatureDataUrl: undefined,
 outcomeEmployeeRevisionNote: undefined,
 workflowPhase: 'AWAITING_OUTCOME_ACK',
 stage: 'OUTCOME_PENDING',
 stageHistory: [
 ...(inv.stageHistory ?? []),
 buildStageHistoryEntry('OUTCOME_PENDING', currentUser.id, inv.ownerId, 'Outcome sent to employee'),
 ],
 lastUpdateAt: now,
 updatedAt: now,
 }
 : inv
 )
 );
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_UPDATED',
 actorUserId: currentUser.id,
 metadata: { investigationId, action: 'OUTCOME_SENT' },
 createdAt: now,
 };
 setActivities((prev) => [newActivity, ...prev]);
 },
 [currentUser.id]
 );

 const employeeAcknowledgeInvestigationOutcome = useCallback(
 (
 investigationId: string,
 response: {
 agreed: boolean;
 signatureDataUrl?: string;
 revisionNote?: string;
 }
 ): { ok: boolean; message?: string } => {
 const inv = investigations.find((i) => i.id === investigationId);
 if (!inv) return { ok: false, message: 'Investigation not found.' };
 const primaryReport = reports.find((r) => inv.linkedReportIds.includes(r.id));
 if (!primaryReport || primaryReport.createdByUserId !== currentUser.id) {
 return { ok: false, message: 'You do not have access to this investigation outcome.' };
 }
 if (inv.outcomeRequiresSignature !== false && response.agreed && !response.signatureDataUrl) {
 return { ok: false, message: 'A signature is required to agree with this outcome.' };
 }
 const now = new Date();
 setInvestigations((prev) =>
 prev.map((i) =>
 i.id === investigationId
 ? {
 ...i,
 outcomeEmployeeSignedAt: now,
 outcomeEmployeeAgreed: response.agreed,
 outcomeEmployeeSignatureDataUrl: response.signatureDataUrl ?? i.outcomeEmployeeSignatureDataUrl,
 outcomeEmployeeRevisionNote: response.revisionNote?.trim() || i.outcomeEmployeeRevisionNote,
 lastUpdateAt: now,
 updatedAt: now,
 }
 : i
 )
 );
 setReports((prev) =>
 prev.map((report) =>
 report.id === primaryReport.id
 ? {
 ...report,
 employeeResponseOutcome: response.agreed
 ? `Employee signed off on investigation outcome on ${now.toLocaleDateString()}.`
 : `Employee did not agree with investigation outcome on ${now.toLocaleDateString()}: ${response.revisionNote?.trim() ?? ''}`,
 updatedAt: now,
 }
 : report
 )
 );
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_UPDATED',
 actorUserId: currentUser.id,
 metadata: {
 investigationId,
 action: response.agreed ? 'OUTCOME_AGREED' : 'OUTCOME_DISAGREED',
 },
 createdAt: now,
 };
 setActivities((prev) => [newActivity, ...prev]);
 return { ok: true };
 },
 [investigations, reports, currentUser.id, effectiveOrgId, setActivities, setInvestigations, setReports]
 );

 const closeInvestigation = useCallback(
 (investigationId: string): { ok: boolean; message?: string } => {
 const inv = investigations.find((item) => item.id === investigationId);
 if (!inv) return { ok: false, message: 'Investigation not found.' };
 const gate = canCloseInvestigation(inv);
 if (!gate.ok) return gate;

 const now = new Date();
 setInvestigations((prev) =>
 prev.map((item) =>
 item.id === investigationId
 ? {
 ...item,
 status: 'CLOSED',
 stage: 'CLOSED',
 workflowPhase: undefined,
 closedAt: now,
 stageHistory: [
 ...(item.stageHistory ?? []),
 buildStageHistoryEntry('CLOSED', currentUser.id, item.ownerId, 'Investigation closed'),
 ],
 lastUpdateAt: now,
 updatedAt: now,
 }
 : item
 )
 );
 const newActivity: ActivityEvent = {
 id: `activity-${Date.now()}`,
 orgId: effectiveOrgId,
 type: 'INVESTIGATION_UPDATED',
 actorUserId: currentUser.id,
 metadata: { investigationId, action: 'CLOSED' },
 createdAt: now,
 };
 setActivities((prev) => [newActivity, ...prev]);
 return { ok: true };
 },
 [currentUser.id, effectiveOrgId, investigations, setActivities, setInvestigations]
 );

 return {
 createInvestigation,
 saveInvestigationProgress,
 advanceInvestigationStage,
 assignInvestigationOwner,
 setInvestigationPersons,
 updateInvestigationChecklist,
 addInvestigationEvidence,
 addInvestigationResponseRequest,
 updateInvestigationResponseRequest,
 submitEmployeeInvestigationResponse,
 updateInvestigationAnalysis,
 addCorrectiveAction,
 updateCorrectiveAction,
 addFollowUp,
 completeFollowUp,
 sendNonRetaliationReminder,
 setInvestigationOutcomeClassification,
 pickUpInvestigation,
 setInvestigationInitialContactNotes,
 saveInvestigationInitialContact,
 unlockInvestigationInitialContact,
 addInitialContactAttachment,
 removeInitialContactAttachment,
 markInvestigationPageComplete,
 setInvestigationSubjectUsers,
 addInvestigationNote,
 sendInvestigationOutcomeToEmployee,
 employeeAcknowledgeInvestigationOutcome,
 closeInvestigation,
 };
}
