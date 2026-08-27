import { useMemo, useState, useRef } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { ReportHandlingEntry, ReportChecklistItem } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/lib/icons';
import {
 getCategoryLabel,
 getSeverityColor,
 getStatusColor,
 formatRelativeTime,
 formatDate,
} from '@/lib/utils';
import { exportCaseCsv, exportCasePdf } from '@/lib/evidenceExport';
import { getInvestigationDisplayId, REPORT_SOURCE_LABELS } from '@/lib/investigationWorkflow';
import { ASSIGN_CASE_TO_ME_ACTION, MARK_INITIAL_REVIEW_ACTION, MARK_INITIAL_REVIEW_TOAST, formatCaseReference, getPayrollExpeditedSlaLabel, getReportStatusLabel } from '@/lib/caseTypes';
import { isIncidentIntakeComplete, isWageHourIntakeComplete } from '@/lib/utils';
import { EmployeeIntakeReadOnly } from '@/components/admin/EmployeeIntakeReadOnly';
import { RelatedRecordsNav } from '@/components/admin/RelatedRecordsNav';
import { OutreachToneCoach } from '@/components/admin/OutreachToneCoach';
import { relatedNavForReport } from '@/lib/recordLinks';
import { toast } from 'sonner';
import { sendNotificationEmail } from '@/lib/api/notifications';
import { buildHrSignOff, getSlaLabel } from '@/lib/reportDetailHelpers';
import { buildCaseNoteReviewEmailBody, caseNoteAckStatusLabel } from '@/lib/caseNoteAcknowledgement';

interface AdminReportDetailProps {
 dataStore: DataStore;
 reportId: string;
 onNavigate: (page: string, params?: Record<string, string>) => void;
 fromInvestigationId?: string;
}

export function AdminReportDetail({ dataStore, reportId, onNavigate, fromInvestigationId }: AdminReportDetailProps) {
 const report = dataStore.reports.find((r) => r.id === reportId);
 const statusEvents = dataStore.reportStatusEvents
 .filter((event) => event.reportId === reportId)
 .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
 const reporter = report?.createdByUserId ? dataStore.users.find((user) => user.id === report.createdByUserId) ?? null : null;
 const assignee = report?.assignedTo ? dataStore.users.find((user) => user.id === report.assignedTo) ?? null : null;

 const [message, setMessage] = useState('');
 const [ledgerType, setLedgerType] = useState<'PLAN' | 'ACTION_TAKEN' | 'EMPLOYEE_RESPONSE' | 'NOTE'>('NOTE');
 const [ledgerText, setLedgerText] = useState('');
 const [plannedSendSubject, setPlannedSendSubject] = useState('Update regarding your workplace concern');
 const [plannedSendBody, setPlannedSendBody] = useState(() => report?.responsePlan ?? '');
 const [includeSignOff, setIncludeSignOff] = useState(true);
 const [requestEmployeeSignOff, setRequestEmployeeSignOff] = useState(true);
 const [checklistSectionIndex, setChecklistSectionIndex] = useState(0);
 const [showAdvancedChecklist, setShowAdvancedChecklist] = useState(false);
 const [showIntakeSubmission, setShowIntakeSubmission] = useState(false);
 const [showRelatedRecords, setShowRelatedRecords] = useState(false);
 const [evidenceNoteDraft, setEvidenceNoteDraft] = useState<Record<string, string>>({});
 const responseContextFileRef = useRef<HTMLInputElement>(null);
 const evidenceFileInputRef = useRef<HTMLInputElement>(null);
 const [evidenceFileForItem, setEvidenceFileForItem] = useState<string | null>(null);
 const [sendingEmployeeEmail, setSendingEmployeeEmail] = useState(false);

 const orderedLedger = useMemo(
 () => [...(report?.handlingLedger ?? [])].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
 [report?.handlingLedger]
 );

 const reportCaseNoteAcks = useMemo(
 () =>
 [...dataStore.caseNoteAcknowledgements]
 .filter((ack) => ack.reportId === reportId)
 .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime()),
 [dataStore.caseNoteAcknowledgements, reportId]
 );

 const responseContextFiles = useMemo(
 () =>
 orderedLedger.filter(
 (entry) =>
 entry.type === 'FILE' &&
 (/\.(png|jpe?g|gif|webp|heic|pdf)$/i.test(entry.fileFileName ?? entry.text) ||
 Boolean(entry.fileDataUrl?.startsWith('data:image/')))
 ),
 [orderedLedger]
 );

 const checklistSections = useMemo(() => {
 const checklist = report?.responseChecklist ?? [];
 const withSection = checklist.filter((i): i is ReportChecklistItem & { sectionId: string } => !!i.sectionId);
 const seen = new Map<string, { label: string; items: ReportChecklistItem[] }>();
 withSection.forEach((item) => {
 const sid = item.sectionId ?? 'legacy';
 if (!seen.has(sid)) {
 seen.set(sid, { label: item.sectionLabel ?? `Section ${sid}`, items: [] });
 }
 seen.get(sid)!.items.push(item);
 });
 return Array.from(seen.entries()).map(([id, v]) => ({ id, ...v }));
 }, [report?.responseChecklist]);

 const legacyChecklistItems = useMemo(
 () => (report?.responseChecklist ?? []).filter((i) => !i.sectionId),
 [report?.responseChecklist]
 );

 const linkedInvestigation = fromInvestigationId
 ? dataStore.investigations.find((i) => i.id === fromInvestigationId)
 : dataStore.investigations.find((i) => i.linkedReportIds.includes(reportId));

 if (!report) {
 return <div className="text-sm text-[var(--mismo-text-secondary)]">Report not found.</div>;
 }

 const caseId = formatCaseReference(report);
 const sourcePrompt = report.sourcePromptId ? dataStore.prompts.find((p) => p.id === report.sourcePromptId) : undefined;
 const sourceResponse = report.sourcePromptResponseId
 ? dataStore.responses.find((r) => r.id === report.sourcePromptResponseId)
 : undefined;
 const intakeComplete =
 report.caseType === 'WAGE_HOUR' ? isWageHourIntakeComplete(report) : isIncidentIntakeComplete(report);
 const reporterIdentity = report.isAnonymous ? 'Anonymous' : reporter ? 'Named' : 'Confidential';
 const reporterDisplay = report.isAnonymous ? 'Anonymous' : reporter ? `${reporter.firstName} ${reporter.lastName}` : 'Confidential';
 const isExpeditedPayroll = report.status === 'PAYROLL_EXPEDITED' && report.expeditedPayroll;
 const payrollSla = isExpeditedPayroll ? getPayrollExpeditedSlaLabel(report) : null;
 const sla = payrollSla?.label
 ? { label: payrollSla.label, overdue: payrollSla.overdue }
 : getSlaLabel(report);

 const hrUser = dataStore.currentUser;
 const messageSignOff = buildHrSignOff({
 firstName: hrUser.firstName,
 lastName: hrUser.lastName,
 jobTitle: hrUser.jobTitle,
 organizationName: dataStore.organizationName,
 caseReference: caseId,
 });

 const convertToInvestigation = () => {
 const inv = dataStore.createInvestigation(report.id, dataStore.currentUser.id);
 if (inv) {
 dataStore.addReportHandlingEntry(
 report.id,
 'NOTE',
 `Converted to investigation ${inv.referenceNumber ?? inv.id}. Opening gather information (Page 2).`
 );
 onNavigate('investigation-detail', { id: inv.id, tab: 'page-2' });
 toast.success('Investigation opened. Continue on Page 2.');
 }
 };

 const sendPlannedMessageToEmployee = async (rawBody: string, subjectLine?: string) => {
 const bodyText = rawBody.trim();
 if (!bodyText) {
 toast.error('Add message text before sending.');
 return;
 }
 const fullBody = includeSignOff ? `${bodyText}${messageSignOff}` : bodyText;
 const subject = (subjectLine ?? plannedSendSubject).trim() || 'Update from Human Resources';
 const recipientUserId = report.createdByUserId;
 if (!recipientUserId || report.isAnonymous) {
 toast.error('No named employee is linked to this case.');
 return;
 }

 setSendingEmployeeEmail(true);
 try {
 dataStore.addReportMessage(report.id, fullBody, { sendEmail: false });
 const employeeRecipient = reporter?.role === 'EMPLOYEE';
 const withSignOffReview = requestEmployeeSignOff && employeeRecipient;
 let ackId: string | undefined;

 if (withSignOffReview) {
 const ack = dataStore.createCaseNoteAcknowledgement({
 reportId: report.id,
 userId: recipientUserId,
 subject,
 body: fullBody,
 });
 ackId = ack.id;
 dataStore.addReportHandlingEntry(
 report.id,
 'ACTION_TAKEN',
 `Sent case note for employee sign-off${reporter?.email ? ` (${reporter.email})` : ''}:\n\n${fullBody}`
 );
 } else {
 dataStore.addReportHandlingEntry(
 report.id,
 'ACTION_TAKEN',
 `Sent planned message to employee${reporter?.email ? ` (${reporter.email})` : ''}:\n\n${fullBody}`
 );
 }

 dataStore.updateReportHandling(report.id, {
 responsePlan: bodyText,
 responseActionTaken: fullBody,
 });

 const emailBody = withSignOffReview && ackId ? buildCaseNoteReviewEmailBody(fullBody) : fullBody;
 const result = await sendNotificationEmail({
 recipientUserId,
 subject: withSignOffReview ? `${subject} (review and sign off)` : subject,
 body: emailBody,
 kind: 'CASE_UPDATE',
 actionPage: withSignOffReview && ackId
 ? `employee/case-note-review/${ackId}`
 : employeeRecipient
 ? `report-detail/${report.id}`
 : 'report-detail',
 actionParams: employeeRecipient || withSignOffReview ? undefined : { id: report.id },
 templateId: 'new_message',
 });

 if (!result) {
 toast.error('Email could not be sent. Check that the API and Resend are configured.');
 return;
 }

 if (result.ok && result.emailStatus === 'sent') {
 toast.success(
 withSignOffReview
 ? `Email sent with sign-off link to ${reporter?.email ?? 'employee'}.`
 : `Email sent to ${reporter?.email ?? 'employee'} via Resend.`
 );
 void dataStore.refreshAppNotifications?.();
 return;
 }

 if (result.ok && result.emailStatus?.startsWith('skipped')) {
 toast.message(withSignOffReview ? 'Case note logged with sign-off request.' : 'Message logged on the case.', {
 description: result.message || 'Resend is not configured for this environment.',
 });
 return;
 }

 toast.error(result.message || 'Email could not be sent.');
 } finally {
 setSendingEmployeeEmail(false);
 }
 };

 return (
 <div className="space-y-5">
 {linkedInvestigation ? (
 <div className="space-y-2">
 <nav className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
 <button
 type="button"
 className="text-[var(--mismo-blue)] hover:underline font-medium"
 onClick={() => onNavigate('investigation-detail', { id: linkedInvestigation.id, tab: 'page-1' })}
 >
 {getInvestigationDisplayId(linkedInvestigation)}
 </button>
 <span aria-hidden>/</span>
 <span className="text-[var(--color-text-primary)] font-mono">{caseId}</span>
 </nav>
 <Button
 variant="ghost"
 onClick={() => onNavigate('investigation-detail', { id: linkedInvestigation.id, tab: 'page-1' })}
 >
 <Icons.arrowLeft className="h-4 w-4 mr-2" />
 Back to investigation
 </Button>
 </div>
 ) : (
 <Button variant="ghost" onClick={() => onNavigate('case-register', { view: 'register', register: '1' })}>
 <Icons.arrowLeft className="h-4 w-4 mr-2" />
 Back to case register
 </Button>
 )}

 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-4 space-y-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div>
 <h2 className="text-sm font-semibold text-[var(--color-primary-900)]">Related records</h2>
 <p className="text-xs text-[var(--color-text-secondary)]">
 Case links, employee profile, check-in response, and registers. Each opens as its own page.
 </p>
 </div>
 <div className="flex flex-wrap gap-2">
 {linkedInvestigation && (
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => onNavigate('investigation-detail', { id: linkedInvestigation.id, tab: 'related' })}
 >
 Open investigation related page
 </Button>
 )}
 <Button type="button" variant="outline" size="sm" onClick={() => setShowRelatedRecords((v) => !v)}>
 {showRelatedRecords ? 'Hide' : 'Show'} related records
 </Button>
 </div>
 </div>
 {showRelatedRecords && (
 <RelatedRecordsNav links={relatedNavForReport(dataStore, report, fromInvestigationId)} onNavigate={onNavigate} />
 )}
 </CardContent>
 </Card>

 {isExpeditedPayroll && (
 <Card className="mismo-card border-2 border-[var(--color-alert-600)]/50 bg-amber-50/80">
 <CardContent className="p-5 space-y-2">
 <p className="font-semibold text-[var(--color-alert-600)]">Expedited payroll memo - no triage</p>
 <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
 The employee flagged a payroll issue without additional details. This case bypasses the normal triage queue.
 An administrator must review and resolve within 24 hours.
 </p>
 {payrollSla && (
 <p className={`text-sm font-medium ${payrollSla.overdue ? 'text-[var(--color-alert-600)]' : 'text-[var(--color-primary-900)]'}`}>
 {payrollSla.label}
 </p>
 )}
 </CardContent>
 </Card>
 )}

 {/* Above-the-fold: Case Command Center header */}
 <Card className="mismo-card border border-[var(--color-border-200)]">
 <CardContent className="p-5 space-y-4">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
 <div className="flex flex-col gap-1 min-w-0 flex-1">
 <div className="flex items-baseline gap-2 flex-wrap">
 <span className="text-sm font-mono font-semibold text-[var(--color-primary-900)]">{caseId}</span>
 <span className="text-[10px] text-[var(--color-text-muted)]">·</span>
 <span className="text-sm text-[var(--color-text-secondary)]">{getCategoryLabel(report.category)}</span>
 </div>
 <p className="text-sm text-[var(--color-text-secondary)] mt-2">
 Reported from:{' '}
 <span className="font-medium text-[var(--color-text-primary)]">
 {REPORT_SOURCE_LABELS[report.reportSourceType ?? 'SELF_REPORTED']}
 </span>
 {sourcePrompt && (
 <>
 {' · '}
 <button
 type="button"
 className="text-[var(--mismo-blue)] hover:underline"
 onClick={() =>
 sourceResponse
 ? onNavigate('prompt-response-detail', { id: sourceResponse.id })
 : onNavigate('prompts')
 }
 >
 {sourcePrompt.title}
 </button>
 </>
 )}
 </p>
 <p className="text-sm mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
 <span className="text-[var(--color-text-secondary)]">
 Employee form:{' '}
 <span className={intakeComplete ? 'text-emerald-800 font-medium' : 'text-amber-800 font-medium'}>
 {intakeComplete ? 'Complete' : 'Pending'}
 </span>
 </span>
 {(intakeComplete || report.description) && (
 <Button type="button" variant="outline" size="sm" onClick={() => setShowIntakeSubmission((v) => !v)}>
 {showIntakeSubmission ? 'Hide employee submission' : 'View employee submission'}
 </Button>
 )}
 </p>
 <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">{report.summary}</h1>
 </div>

 <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
 {linkedInvestigation ? (
 <Button
 size="lg"
 className="min-h-12 px-6 text-base font-semibold"
 onClick={() => onNavigate('investigation-detail', { id: linkedInvestigation.id, tab: 'page-2' })}
 >
 Open investigation
 </Button>
 ) : (
 <Button
 size="lg"
 className="min-h-12 px-6 text-base font-semibold bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)] text-white"
 onClick={convertToInvestigation}
 >
 Convert to investigation
 </Button>
 )}
 </div>
 </div>

 <div className="flex flex-wrap items-center gap-2">
 <Badge className={getSeverityColor(report.severity)}>{report.severity}</Badge>
 <Badge className={getStatusColor(report.status)}>{getReportStatusLabel(report.status)}</Badge>
 </div>

 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-sm border-t border-[var(--color-border-200)] pt-4">
 <div>
 <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide">Created</p>
 <p className="font-medium">{formatDate(report.createdAt)}</p>
 </div>
 <div>
 <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide">Last updated</p>
 <p className="font-medium">{formatRelativeTime(report.updatedAt)}</p>
 </div>
 <div>
 <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide">Reporter</p>
 <p className="font-medium">
 {report.isAnonymous || !reporter ? (
 <>
 {reporterDisplay} <span className="text-[var(--color-text-muted)]">({reporterIdentity})</span>
 </>
 ) : (
 <>
 <button
 type="button"
 className="text-[var(--mismo-blue)] hover:underline font-medium"
 onClick={() => onNavigate('employee-detail', { id: reporter.id })}
 >
 {reporterDisplay}
 </button>{' '}
 <span className="text-[var(--color-text-muted)]">({reporterIdentity})</span>
 </>
 )}
 </p>
 </div>
 <div>
 <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide">Assigned owner</p>
 <p className="font-medium">
 {assignee ? (
 <button
 type="button"
 className="text-[var(--mismo-blue)] hover:underline"
 onClick={() => onNavigate('employee-detail', { id: assignee.id })}
 >
 {assignee.firstName} {assignee.lastName}
 </button>
 ) : (
 'Unassigned'
 )}
 </p>
 </div>
 <div>
 <p className="text-[var(--color-text-muted)] text-xs uppercase tracking-wide">SLA</p>
 <p className={`font-medium ${sla.overdue ? 'text-[var(--color-alert-600)]' : ''}`}>{sla.label}</p>
 </div>
 </div>

 {intakeComplete && report.description && (
 <p className="text-[var(--mismo-text-secondary)] text-sm">{report.description}</p>
 )}

 <div className="flex flex-wrap gap-2 border-t border-[var(--color-border-200)] pt-4">
 <Button variant="outline" onClick={() => dataStore.assignReport(report.id, dataStore.currentUser.id)}>{ASSIGN_CASE_TO_ME_ACTION}</Button>
 {!isExpeditedPayroll && (
 <Button
 variant="outline"
 onClick={() => {
 dataStore.updateReportStatus(report.id, 'TRIAGED', 'Initial review complete');
 dataStore.addReportHandlingEntry(
 report.id,
 'NOTE',
 'Initial review complete. Case triaged and ready for investigation conversion or follow-up.'
 );
 toast.success(MARK_INITIAL_REVIEW_TOAST);
 }}
 >
 {MARK_INITIAL_REVIEW_ACTION}
 </Button>
 )}
 <Button
 className={isExpeditedPayroll ? 'bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)] text-white' : undefined}
 variant={isExpeditedPayroll ? 'default' : 'outline'}
 onClick={() => dataStore.updateReportStatus(report.id, 'RESOLVED')}
 >
 {isExpeditedPayroll ? 'Resolve payroll issue' : 'Resolve'}
 </Button>
 <Button
 variant="outline"
 onClick={() => {
 dataStore.updateReportStatus(report.id, 'NEEDS_INFO');
 dataStore.addReportMessage(report.id, 'Additional information requested from employee.');
 }}
 >
 Request Info
 </Button>
 <Button
 variant="outline"
 onClick={() => {
 exportCaseCsv({ report, statusEvents, reporter, assignee });
 dataStore.logExportEvent(report.id, 'CSV');
 dataStore.updateReportHandling(report.id, {
 evidenceMetadata: { lastExportedAt: new Date(), lastExportedBy: dataStore.currentUser.id },
 });
 }}
 >
 Export CSV Evidence
 </Button>
 <Button
 variant="outline"
 onClick={() => {
 exportCasePdf({ report, statusEvents, reporter, assignee });
 dataStore.logExportEvent(report.id, 'PDF');
 dataStore.updateReportHandling(report.id, {
 evidenceMetadata: { lastExportedAt: new Date(), lastExportedBy: dataStore.currentUser.id },
 });
 }}
 >
 Export PDF Evidence
 </Button>
 </div>
 {report.evidenceMetadata?.lastExportedAt && (
 <p className="text-xs text-[var(--color-text-secondary)]">
 Last export: {report.evidenceMetadata.lastExportedAt.toLocaleString()}
 </p>
 )}
 </CardContent>
 </Card>

 {showIntakeSubmission && (
 <EmployeeIntakeReadOnly report={report} organizationName={dataStore.organizationName} />
 )}

 <Card className="mismo-card">
 <CardContent className="p-5 space-y-4">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div>
 <h2 className="text-sm uppercase tracking-wide text-[var(--color-text-secondary)]">
 Optional compliance checklist
 </h2>
 <p className="text-xs text-[var(--color-text-muted)] mt-1">
 Intake, case ID, and assignment are handled automatically on the investigation (Page 1). Expand this only
 if you need the legacy section-by-section checklist.
 </p>
 </div>
 <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvancedChecklist((v) => !v)}>
 {showAdvancedChecklist ? 'Hide checklist' : 'Show checklist'}
 </Button>
 </div>
 {!showAdvancedChecklist ? (
 <p className="text-sm text-[var(--color-text-secondary)]">
 {linkedInvestigation ? (
 <>
 Continue in{' '}
 <button
 type="button"
 className="text-[var(--mismo-blue)] hover:underline"
 onClick={() =>
 onNavigate('investigation-detail', { id: linkedInvestigation.id, tab: 'page-1' })
 }
 >
 investigation {getInvestigationDisplayId(linkedInvestigation)}
 </button>{' '}
 for the simplified 3-page workflow.
 </>
 ) : (
 'Convert to an investigation to use the 3-page intake → gather → outcome flow.'
 )}
 </p>
 ) : null}
 {showAdvancedChecklist && checklistSections.length === 0 && legacyChecklistItems.length === 0 ? (
 <p className="text-sm text-[var(--color-text-secondary)]">No checklist items. Checklist is created for new cases.</p>
 ) : showAdvancedChecklist ? (
 <>
 {checklistSections.length > 0 && (
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-xs text-[var(--color-text-secondary)]">
 Section {checklistSectionIndex + 1} of {checklistSections.length}
 </span>
 <Button
 type="button"
 variant="outline"
 size="sm"
 disabled={checklistSectionIndex <= 0}
 onClick={() => setChecklistSectionIndex((i) => Math.max(0, i - 1))}
 >
 Previous
 </Button>
 <Button
 type="button"
 variant="outline"
 size="sm"
 disabled={checklistSectionIndex >= checklistSections.length - 1}
 onClick={() => setChecklistSectionIndex((i) => Math.min(checklistSections.length - 1, i + 1))}
 >
 Next
 </Button>
 </div>
 )}
 {checklistSections.length > 0 && checklistSections[checklistSectionIndex] && (
 <div className="space-y-2">
 <p className="font-medium text-[var(--color-text-primary)]">{checklistSections[checklistSectionIndex].label}</p>
 {checklistSections[checklistSectionIndex].items.map((item) => (
 <div key={item.id} className="border border-[var(--color-border-200)] p-3 space-y-2">
 <label className="flex items-start gap-2">
 <input
 type="checkbox"
 checked={item.completed}
 onChange={(e) => {
 dataStore.toggleReportChecklistItem(report.id, item.id, e.target.checked);
 if (e.target.checked && evidenceNoteDraft[item.id])
 dataStore.updateReportChecklistItemEvidence(report.id, item.id, { evidenceNote: evidenceNoteDraft[item.id] });
 }}
 className="mt-1"
 />
 <span className="text-sm">{item.label}</span>
 </label>
 {item.completed && (
 <div className="ml-6 space-y-1 text-xs">
 {item.completedAt && (
 <p className="text-[var(--color-text-secondary)]">
 Completed {item.completedAt.toLocaleString()}
 {item.evidenceNote && ` · ${item.evidenceNote}`}
 </p>
 )}
 {item.evidenceFileFileName && item.evidenceFileDataUrl && (
 <p>
 Evidence: <a href={item.evidenceFileDataUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-emerald-600)] underline">{item.evidenceFileFileName}</a>
 </p>
 )}
 </div>
 )}
 {!item.completed && (
 <div className="ml-6 flex flex-col gap-2">
 <input
 type="text"
 placeholder="Evidence note (optional)"
 value={evidenceNoteDraft[item.id] ?? ''}
 onChange={(e) => setEvidenceNoteDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
 className="border border-[var(--color-border-200)] px-2 py-1 text-sm w-full max-w-md"
 />
 <div className="flex items-center gap-2">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 setEvidenceFileForItem(item.id);
 setTimeout(() => evidenceFileInputRef.current?.click(), 0);
 }}
 >
 Attach PDF evidence
 </Button>
 </div>
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 {checklistSections.length === 0 && legacyChecklistItems.length > 0 && (
 <div className="space-y-2">
 {legacyChecklistItems.map((item) => (
 <label key={item.id} className="flex items-start gap-2 border border-[var(--color-border-200)] p-2">
 <input
 type="checkbox"
 checked={item.completed}
 onChange={(e) => dataStore.toggleReportChecklistItem(report.id, item.id, e.target.checked)}
 className="mt-1"
 />
 <span className="text-sm">{item.label}</span>
 </label>
 ))}
 </div>
 )}
 </>
 ) : null}
 {/* Single hidden file input for checklist item evidence */}
 {showAdvancedChecklist && checklistSections.length > 0 && (
 <input
 ref={evidenceFileInputRef}
 type="file"
 accept=".pdf,application/pdf"
 className="hidden"
 onChange={(e) => {
 const file = e.target.files?.[0];
 const itemId = evidenceFileForItem;
 if (file && itemId && dataStore.updateReportChecklistItemEvidence) {
 const reader = new FileReader();
 reader.onload = () => {
 dataStore.updateReportChecklistItemEvidence(report.id, itemId, {
 evidenceFileFileName: file.name,
 evidenceFileDataUrl: reader.result as string,
 });
 setEvidenceFileForItem(null);
 };
 reader.readAsDataURL(file);
 }
 e.target.value = '';
 }}
 />
 )}
 </CardContent>
 </Card>

 <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
 <Card className="mismo-card xl:col-span-2">
 <CardContent className="p-5 space-y-4">
 <div>
 <h2 className="text-sm uppercase tracking-wide text-[var(--color-text-secondary)]">Handling ledger</h2>
 <p className="text-xs text-[var(--color-text-muted)] mt-1">
 Log notes and plan entries, attach message screenshots, soften drafts with AI, and send planned responses to the employee with your sign-off.
 </p>
 </div>

 <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-3 space-y-3">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div>
 <p className="text-sm font-medium text-[var(--color-text-primary)]">Context attachments</p>
 <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
 Upload screenshots of texts or emails (PNG, JPG, WEBP, PDF). AI uses these when drafting a planned response.
 </p>
 </div>
 <div>
 <input
 ref={responseContextFileRef}
 type="file"
 accept="image/png,image/jpeg,image/webp,image/gif,image/heic,.png,.jpg,.jpeg,.webp,.gif,.heic,.pdf,application/pdf"
 multiple
 className="hidden"
 onChange={(e) => {
 const files = Array.from(e.target.files ?? []);
 files.forEach((file) => {
 if (dataStore.addReportLedgerFile) dataStore.addReportLedgerFile(report.id, file);
 });
 e.target.value = '';
 }}
 />
 <Button type="button" variant="outline" size="sm" onClick={() => responseContextFileRef.current?.click()}>
 <Icons.upload className="h-3.5 w-3.5 mr-1.5" />
 Upload screenshot / email
 </Button>
 </div>
 </div>
 {responseContextFiles.length > 0 ? (
 <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
 {responseContextFiles.map((entry) => {
 const isImage = Boolean(
 entry.fileDataUrl?.startsWith('data:image/') ||
 /\.(png|jpe?g|gif|webp|heic)$/i.test(entry.fileFileName ?? entry.text)
 );
 return (
 <li key={entry.id} className="border border-[var(--color-border-200)] bg-white p-2 text-sm space-y-1">
 {isImage && entry.fileDataUrl ? (
 <button
 type="button"
 className="block w-full text-left"
 onClick={() => {
 const url = entry.fileDataUrl!;
 window.setTimeout(() => {
 window.open(url, '_blank', 'noopener,noreferrer');
 }, 0);
 }}
 >
 <img
 src={entry.fileDataUrl}
 alt={entry.fileFileName ?? entry.text}
 className="max-h-36 w-full object-contain bg-[var(--color-surface-200)]"
 loading="lazy"
 decoding="async"
 />
 </button>
 ) : null}
 <p className="font-medium truncate">{entry.fileFileName ?? entry.text}</p>
 <p className="text-xs text-[var(--color-text-secondary)]">{entry.createdAt.toLocaleString()}</p>
 <div className="flex flex-wrap items-center gap-3">
 {entry.fileDataUrl ? (
 <button
 type="button"
 className="text-xs text-[var(--mismo-blue)] underline"
 onClick={() => {
 const url = entry.fileDataUrl!;
 window.setTimeout(() => {
 window.open(url, '_blank', 'noopener,noreferrer');
 }, 0);
 }}
 >
 Open / download
 </button>
 ) : null}
 <button
 type="button"
 className="text-xs text-[var(--color-alert-600)] hover:underline"
 onClick={() => {
 dataStore.removeReportLedgerEntry(report.id, entry.id);
 toast.success('Attachment removed.');
 }}
 >
 Remove
 </button>
 </div>
 </li>
 );
 })}
 </ul>
 ) : (
 <p className="text-xs text-[var(--color-text-secondary)]">No context attachments yet.</p>
 )}
 </div>

 <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-3 space-y-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <p className="text-sm font-medium">Planned response</p>
 <div className="flex flex-wrap gap-2">
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => setPlannedSendBody(report.responsePlan ?? '')}
 disabled={!report.responsePlan?.trim()}
 >
 Use saved plan
 </Button>
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => {
 const lastPlan = orderedLedger.find((e) => e.type === 'PLAN');
 if (lastPlan) setPlannedSendBody(lastPlan.text);
 }}
 disabled={!orderedLedger.some((e) => e.type === 'PLAN')}
 >
 Use latest plan entry
 </Button>
 </div>
 </div>
 <input
 value={plannedSendSubject}
 onChange={(e) => setPlannedSendSubject(e.target.value)}
 className="w-full border border-[var(--color-border-200)] px-3 py-2 text-sm bg-white"
 placeholder="Email subject"
 />
 <textarea
 value={plannedSendBody}
 onChange={(e) => setPlannedSendBody(e.target.value)}
 className="w-full min-h-[120px] border border-[var(--color-border-200)] p-2 text-sm bg-white"
 placeholder="Paste the message you are responding to, or draft your planned response…"
 />
 <OutreachToneCoach
 bodyOnly
 task={responseContextFiles.length > 0 ? 'draft_from_screenshots' : 'soften'}
 title={responseContextFiles.length > 0 ? 'Draft from screenshots' : 'Soften with AI'}
 description={
 responseContextFiles.length > 0
 ? 'AI reads uploaded screenshots and drafts a professional follow-up. Softens existing text when a draft is already entered.'
 : 'AI softens your draft for clear, professional employee outreach. Attach screenshots above for richer context.'
 }
 orgId={report.orgId}
 reportId={report.id}
 investigationId={linkedInvestigation?.id}
 subject={plannedSendSubject}
 body={plannedSendBody}
 caseCategory={report.category}
 caseType={report.caseType}
 createdBy={dataStore.currentUser.id}
 contextAttachments={responseContextFiles}
 employeeEmail={reporter?.email}
 employeeName={reporter ? `${reporter.firstName} ${reporter.lastName}`.trim() : undefined}
 onApplySuggestion={(_subject, nextBody) => setPlannedSendBody(nextBody)}
 />
 <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
 <input
 type="checkbox"
 checked={includeSignOff}
 onChange={(e) => setIncludeSignOff(e.target.checked)}
 />
 Include my sign-off
 </label>
 <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
 <input
 type="checkbox"
 checked={requestEmployeeSignOff}
 onChange={(e) => setRequestEmployeeSignOff(e.target.checked)}
 disabled={report.isAnonymous || !report.createdByUserId}
 />
 Request employee sign-off (email includes link to review in Mismo)
 </label>
 {includeSignOff && (
 <pre className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap border border-dashed border-[var(--color-border-200)] bg-white p-2 rounded-sm">
 {messageSignOff.trim()}
 </pre>
 )}
 <div className="flex flex-wrap gap-2">
 <Button
 type="button"
 size="sm"
 className="flex-1 min-w-[140px] justify-center"
 onClick={() => void sendPlannedMessageToEmployee(plannedSendBody, plannedSendSubject)}
 disabled={!plannedSendBody.trim() || sendingEmployeeEmail || !report.createdByUserId || report.isAnonymous}
 >
 <Icons.mail className="h-3.5 w-3.5 mr-1.5" />
 {sendingEmployeeEmail ? 'Sending…' : 'Send to employee'}
 </Button>
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="flex-1 min-w-[140px] justify-center"
 onClick={() => {
 if (!plannedSendBody.trim()) return;
 dataStore.updateReportHandling(report.id, { responsePlan: plannedSendBody.trim() });
 dataStore.addReportHandlingEntry(report.id, 'PLAN', plannedSendBody.trim());
 toast.success('Planned response logged (not sent).');
 }}
 disabled={!plannedSendBody.trim()}
 >
 Log as plan only
 </Button>
 </div>
 {reportCaseNoteAcks.length > 0 && (
 <div className="border border-[var(--color-border-200)] bg-white rounded-md p-3 space-y-2">
 <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Employee sign-off status</p>
 <ul className="space-y-2">
 {reportCaseNoteAcks.map((ack) => (
 <li key={ack.id} className="text-sm border border-[var(--color-border-200)] rounded px-2 py-1.5">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <span className="font-medium">{ack.subject}</span>
 <Badge variant="outline" className="text-xs">
 {caseNoteAckStatusLabel(ack.status)}
 </Badge>
 </div>
 <p className="text-xs text-[var(--color-text-muted)] mt-1">
 Sent {formatRelativeTime(ack.sentAt)}
 {ack.respondedAt ? ` · Responded ${formatRelativeTime(ack.respondedAt)}` : ''}
 </p>
 {ack.status === 'REVISION_REQUESTED' && ack.revisionNote && (
 <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-1 whitespace-pre-wrap">
 {ack.revisionNote}
 </p>
 )}
 </li>
 ))}
 </ul>
 </div>
 )}
 {!reporter?.email && report.createdByUserId && !report.isAnonymous && (
 <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
 No employee email on file. Sending will still log the message on the case.
 </p>
 )}
 </div>

 <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-3 space-y-3">
 <p className="text-sm font-medium">Log handling entry</p>
 <div className="flex flex-col sm:flex-row gap-2">
 <select
 value={ledgerType}
 onChange={(event) => setLedgerType(event.target.value as typeof ledgerType)}
 className="border border-[var(--color-border-200)] px-2 py-2 text-sm bg-white sm:w-44"
 >
 <option value="NOTE">Case note</option>
 <option value="PLAN">Plan entry</option>
 <option value="ACTION_TAKEN">Action taken</option>
 <option value="EMPLOYEE_RESPONSE">Employee response</option>
 </select>
 </div>
 <textarea
 value={ledgerText}
 onChange={(event) => setLedgerText(event.target.value)}
 className="w-full min-h-[88px] border border-[var(--color-border-200)] px-3 py-2 text-sm bg-white"
 placeholder={
 ledgerType === 'PLAN'
 ? 'Internal plan or draft wording…'
 : ledgerType === 'ACTION_TAKEN'
 ? 'What was said or done…'
 : ledgerType === 'EMPLOYEE_RESPONSE'
 ? 'How the employee responded…'
 : 'Internal case note…'
 }
 />
 {(ledgerType === 'PLAN' || ledgerType === 'ACTION_TAKEN' || ledgerType === 'NOTE') && ledgerText.trim() && (
 <OutreachToneCoach
 bodyOnly
 task={ledgerType === 'PLAN' && responseContextFiles.length > 0 ? 'draft_from_screenshots' : 'soften'}
 title="Soften with AI"
 description="Clean up this entry before logging it on the case."
 orgId={report.orgId}
 reportId={report.id}
 investigationId={linkedInvestigation?.id}
 subject={ledgerType}
 body={ledgerText}
 caseCategory={report.category}
 caseType={report.caseType}
 createdBy={dataStore.currentUser.id}
 contextAttachments={responseContextFiles}
 onApplySuggestion={(_subject, nextBody) => setLedgerText(nextBody)}
 />
 )}
 <div className="flex flex-wrap gap-2">
 <Button
 size="sm"
 onClick={() => {
 if (!ledgerText.trim()) {
 toast.error('Add text before logging.');
 return;
 }
 dataStore.addReportHandlingEntry(report.id, ledgerType, ledgerText.trim());
 if (ledgerType === 'PLAN') {
 dataStore.updateReportHandling(report.id, { responsePlan: ledgerText.trim() });
 } else if (ledgerType === 'ACTION_TAKEN') {
 dataStore.updateReportHandling(report.id, { responseActionTaken: ledgerText.trim() });
 } else if (ledgerType === 'EMPLOYEE_RESPONSE') {
 dataStore.updateReportHandling(report.id, { employeeResponseOutcome: ledgerText.trim() });
 }
 setLedgerText('');
 toast.success('Entry logged.');
 }}
 >
 Log entry
 </Button>
 </div>
 </div>

 <div className="space-y-2 max-h-[360px] overflow-auto">
 {orderedLedger.map((entry) => (
 <div key={entry.id} className="border border-[var(--color-border-200)] p-2 text-sm space-y-2">
 <p className="font-medium">{(entry as ReportHandlingEntry).type.replace('_', ' ')}</p>
 <p className="whitespace-pre-wrap">{entry.text}</p>
 {(entry as ReportHandlingEntry).type === 'FILE' && (entry as ReportHandlingEntry).fileDataUrl && (
 <p className="mt-1">
 <a
 href={(entry as ReportHandlingEntry).fileDataUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="text-[var(--color-emerald-600)] underline"
 >
 Open / download {(entry as ReportHandlingEntry).fileFileName ?? entry.text}
 </a>
 </p>
 )}
 <div className="flex flex-wrap items-center gap-2">
 <p className="text-xs text-[var(--color-text-secondary)]">{entry.createdAt.toLocaleString()}</p>
 {(entry.type === 'PLAN' || entry.type === 'NOTE' || entry.type === 'ACTION_TAKEN') &&
 entry.text.trim() &&
 !entry.text.startsWith('Sent planned message') && (
 <>
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="h-7 text-xs"
 onClick={() => {
 setPlannedSendBody(entry.text);
 toast.message('Loaded into planned response above.');
 }}
 >
 Edit &amp; send
 </Button>
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="h-7 text-xs"
 onClick={() => void sendPlannedMessageToEmployee(entry.text, plannedSendSubject)}
 disabled={sendingEmployeeEmail || !report.createdByUserId || report.isAnonymous}
 >
 <Icons.mail className="h-3 w-3 mr-1" />
 {sendingEmployeeEmail ? 'Sending…' : 'Send with sign-off'}
 </Button>
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="h-7 text-xs"
 onClick={() => {
 const text = includeSignOff ? `${entry.text.trim()}${messageSignOff}` : entry.text;
 void navigator.clipboard.writeText(text);
 toast.success(includeSignOff ? 'Copied with sign-off.' : 'Copied.');
 }}
 >
 Copy
 </Button>
 </>
 )}
 </div>
 </div>
 ))}
 {orderedLedger.length === 0 && <p className="text-sm text-[var(--color-text-secondary)]">No handling entries yet.</p>}
 </div>
 </CardContent>
 </Card>

 <Card className="mismo-card">
 <CardContent className="p-5 space-y-3">
 <h2 className="text-sm uppercase tracking-wide text-[var(--color-text-secondary)]">Status timeline + messages</h2>
 <div className="space-y-2">
 {statusEvents.map((event) => (
 <div key={event.id} className="text-sm border border-[var(--color-border-200)] p-2">
 <p>{event.fromStatus} -&gt; {event.toStatus}</p>
 {event.note && <p className="text-[var(--mismo-text-secondary)]">{event.note}</p>}
 <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">{event.createdAt.toLocaleString()}</p>
 </div>
 ))}
 {statusEvents.length === 0 && <p className="text-sm text-[var(--mismo-text-secondary)]">No status changes yet.</p>}
 </div>

 <div className="space-y-2">
 {(report.messages ?? []).map((msg) => (
 <div key={msg.id} className="text-sm border border-[var(--color-border-200)] p-2">
 <p>{msg.body}</p>
 <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">{msg.createdAt.toLocaleString()}</p>
 </div>
 ))}
 {(report.messages ?? []).length === 0 && <p className="text-sm text-[var(--mismo-text-secondary)]">No messages yet.</p>}
 </div>

 <div className="flex gap-2">
 <input
 className="flex-1 border border-[var(--color-border-200)] px-3 py-2 text-sm"
 placeholder="Add internal note or request message..."
 value={message}
 onChange={(event) => setMessage(event.target.value)}
 />
 <Button
 onClick={() => {
 if (!message.trim()) return;
 dataStore.addReportMessage(report.id, message.trim());
 dataStore.addReportHandlingEntry(report.id, 'NOTE', message.trim());
 setMessage('');
 }}
 >
 Send
 </Button>
 </div>
 </CardContent>
 </Card>
 </div>
 </div>
 );
}
