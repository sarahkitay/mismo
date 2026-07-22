import { useEffect, useState } from 'react';
import type { PromptAnswer } from '@/types';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { clearCheckInDeferralForToday, shouldShowCheckInGate } from '@/lib/checkInGate';
import { toast } from 'sonner';
import {
 PAYROLL_EXPEDITED_EMPLOYEE_MESSAGE,
 PAYROLL_EXPEDITED_QUICK_LABEL,
 PAYROLL_MEMO_CHOICE_HEADING,
 PAYROLL_MEMO_FULL_DESCRIPTION,
 PAYROLL_MEMO_QUICK_DESCRIPTION,
 formatCaseReference,
} from '@/lib/caseTypes';

const EQC_INCIDENT_QUESTION =
 "Have you experienced or witnessed an incident or occurrence which you perceive to be a violation of your or your co-worker's employment rights that you have not reported prior to this question.";

const EQC_RETALIATION_NOTE =
 'You will not be retaliated against for sharing a concern in good faith. Retaliation is against the law and is not tolerated by this company.';

const EQC_CONFIRMATION_BODY =
 'Mismo will relay your response to the individuals designated by the company to receive it. You will be contacted to discuss the circumstances surrounding your response in the very near future, pursuant to the company\'s policy.';

const FINANCIAL_SCREENING_QUESTION =
 'Are you aware of any issue related to pay, bonuses, reimbursements, benefits, or other compensation that you believe may be incorrect, withheld without proper explanation, or inconsistent with company policy or applicable law?';

const FINANCIAL_SCREENING_NOTE =
 'This pay and compensation screening is part of your organization\'s daily check-in. Your answer is stored with your check-in response.';

function formatEqcHeaderDate(d: Date): string {
 const mm = String(d.getMonth() + 1).padStart(2, '0');
 const dd = String(d.getDate()).padStart(2, '0');
 const yyyy = d.getFullYear();
 return `${mm}.${dd}.${yyyy}`;
}

export type DailyCheckInPortal = 'employee' | 'staff';

export function useDailyCheckInViewState(dataStore: DataStore) {
 const { currentUser, pendingPromptsForEmployee, responses, organizationName } = dataStore;
 const heroPrompt = pendingPromptsForEmployee[0];
 const heroPromptAlreadyAnswered = Boolean(
 heroPrompt &&
 responses.some(
 (r) => r.promptDeliveryId === heroPrompt.id && r.userId === currentUser.id && r.finalizedAt
 )
 );
 const showCheckInGate = Boolean(
 heroPrompt && !heroPromptAlreadyAnswered && shouldShowCheckInGate(currentUser.id, heroPrompt.id)
 );
 const showDeferredCheckInBanner = Boolean(heroPrompt && !heroPromptAlreadyAnswered && !showCheckInGate);
 const isIncidentGate = Boolean(heroPrompt?.prompt.type === 'INCIDENT');

 return {
 heroPrompt,
 showCheckInGate,
 showDeferredCheckInBanner,
 isIncidentGate,
 organizationName,
 hasPendingCheckIn: Boolean(heroPrompt && !heroPromptAlreadyAnswered),
 };
}

interface DailyCheckInGateProps {
 dataStore: DataStore;
 onNavigate: (page: string, params?: Record<string, string>) => void;
 portal: DailyCheckInPortal;
}

export function DailyCheckInGate({ dataStore, onNavigate, portal }: DailyCheckInGateProps) {
 const {
 currentUser,
 submitPromptResponse,
 submitIncidentPromptYes,
 submitExpeditedPayrollReport,
 beginWageHourCase,
 organizationName,
 } = dataStore;

 const { heroPrompt, showCheckInGate, showDeferredCheckInBanner, isIncidentGate } =
 useDailyCheckInViewState(dataStore);

 const wantsFinancialFollowUp = Boolean(heroPrompt?.prompt.includeFinancialQuestion);
 const [incidentStep, setIncidentStep] = useState<'question' | 'yes_confirm'>('question');
 const [, setCheckInDeferTick] = useState(0);
 type FinancialFollowUp = {
 deliveryId: string;
 answer: PromptAnswer;
 promptIdForReport?: string;
 incidentRestoreStep?: 'question' | 'yes_confirm';
 };
 const [financialFollowUp, setFinancialFollowUp] = useState<FinancialFollowUp | null>(null);
 const [financialPayrollChoice, setFinancialPayrollChoice] = useState(false);

 useEffect(() => {
 setIncidentStep('question');
 setFinancialFollowUp(null);
 setFinancialPayrollChoice(false);
 }, [heroPrompt?.id]);

 const checkInStepLabel = financialFollowUp
 ? 'Question 2 of 2'
 : wantsFinancialFollowUp && showCheckInGate
 ? 'Question 1 of 2'
 : null;
 const eqcHeaderDate = formatEqcHeaderDate(new Date());

 const goToReport = (reportId: string) => {
 if (portal === 'staff') {
 onNavigate('report-detail', { id: reportId });
 } else {
 onNavigate(`incident-intake/${reportId}`);
 }
 };

 const goToWageHour = (reportId: string) => {
 if (portal === 'staff') {
 onNavigate('report-detail', { id: reportId });
 } else {
 onNavigate(`wage-hour-intake/${reportId}`);
 }
 };

 const goToNewReport = (promptId: string, deliveryId: string) => {
 if (portal === 'staff') {
 toast.info('Your response was recorded. Open the case from Prompt Responses or the action register.');
 onNavigate('prompt-responses', { view: 'prompts', answer: 'HAS_ISSUE' });
 return;
 }
 onNavigate('report-new', { promptId, deliveryId });
 };

 const submitFinancialAndClose = (hasPayConcern: boolean) => {
 if (!financialFollowUp) return;
 const note = hasPayConcern
 ? 'Financial follow-up: employee indicated a pay, compensation, or benefits-related concern.'
 : 'Financial follow-up: no pay, compensation, or benefits-related concern indicated.';
 const { deliveryId, answer, promptIdForReport } = financialFollowUp;
 setFinancialFollowUp(null);
 setFinancialPayrollChoice(false);
 setIncidentStep('question');

 if (answer === 'HAS_ISSUE' && isIncidentGate) {
 const result = submitIncidentPromptYes(deliveryId, note);
 if (result) {
 toast.success('Response recorded and a secure case has been opened.', { duration: 7000 });
 goToReport(result.report.id);
 }
 return;
 }

 submitPromptResponse(deliveryId, answer, note);
 if (answer === 'HAS_ISSUE' && promptIdForReport) {
 goToNewReport(promptIdForReport, deliveryId);
 } else if (answer === 'NO_ISSUE' && isIncidentGate) {
 toast.success('Your response has been recorded. No further action is needed for this check-in.');
 } else {
 toast.success('Response recorded in compliance log.');
 }
 };

 const handleFinancialYesConcern = () => {
 if (!financialFollowUp) return;
 if (financialFollowUp.answer === 'HAS_ISSUE' && isIncidentGate) {
 submitFinancialAndClose(true);
 return;
 }
 setFinancialPayrollChoice(true);
 };

 const submitExpeditedPayrollFromCheckIn = () => {
 if (!financialFollowUp) return;
 const report = submitExpeditedPayrollReport(currentUser.id, {
 deliveryId: financialFollowUp.deliveryId,
 promptId: heroPrompt?.prompt.id,
 sourceType: 'EMPLOYEE_PROMPT_RESPONSE',
 });
 setFinancialFollowUp(null);
 setFinancialPayrollChoice(false);
 setIncidentStep('question');
 toast.success(PAYROLL_EXPEDITED_EMPLOYEE_MESSAGE, { duration: 9000 });
 if (report) {
 toast.message(`Reference ${formatCaseReference(report)}`, { duration: 5000 });
 if (portal === 'staff') onNavigate('report-detail', { id: report.id });
 }
 };

 const submitFullPayrollFromCheckIn = () => {
 if (!financialFollowUp) return;
 const { deliveryId } = financialFollowUp;
 submitPromptResponse(
 deliveryId,
 'HAS_ISSUE',
 'Financial follow-up: employee chose to complete the full wage & hour report sheet.'
 );
 const report = beginWageHourCase(currentUser.id, 'EMPLOYEE_PROMPT_RESPONSE');
 setFinancialFollowUp(null);
 setFinancialPayrollChoice(false);
 setIncidentStep('question');
 toast.success(`Complete the report sheet to submit details (${formatCaseReference(report)}).`, { duration: 7000 });
 goToWageHour(report.id);
 };

 const cancelFinancialFollowUp = () => {
 if (financialFollowUp?.incidentRestoreStep) {
 setIncidentStep(financialFollowUp.incidentRestoreStep);
 }
 setFinancialFollowUp(null);
 setFinancialPayrollChoice(false);
 };

 const handleNoIssues = (deliveryId: string) => {
 if (wantsFinancialFollowUp) {
 setFinancialFollowUp({
 deliveryId,
 answer: 'NO_ISSUE',
 incidentRestoreStep: isIncidentGate ? incidentStep : undefined,
 });
 return;
 }
 submitPromptResponse(deliveryId, 'NO_ISSUE');
 toast.success(
 isIncidentGate
 ? 'Your response has been recorded. No further action is needed for this check-in.'
 : 'Your response has been recorded.'
 );
 };

 const handleHaveIssueWithReport = (deliveryId: string, promptId: string) => {
 if (wantsFinancialFollowUp) {
 setFinancialFollowUp({ deliveryId, answer: 'HAS_ISSUE', promptIdForReport: promptId });
 return;
 }
 submitPromptResponse(deliveryId, 'HAS_ISSUE');
 goToNewReport(promptId, deliveryId);
 };

 const handleIncidentYesSubmit = (deliveryId: string) => {
 if (wantsFinancialFollowUp) {
 setFinancialFollowUp({ deliveryId, answer: 'HAS_ISSUE', incidentRestoreStep: 'yes_confirm' });
 return;
 }
 const result = submitIncidentPromptYes(deliveryId);
 setIncidentStep('question');
 if (result) {
 toast.success('Response recorded. Complete intake to add details.', { duration: 7000 });
 goToReport(result.report.id);
 }
 };

 const handleResumeCheckIn = () => {
 if (!heroPrompt) return;
 clearCheckInDeferralForToday(currentUser.id, heroPrompt.id);
 setFinancialFollowUp(null);
 setFinancialPayrollChoice(false);
 setIncidentStep('question');
 setCheckInDeferTick((t) => t + 1);
 window.scrollTo(0, 0);
 };

 if (!heroPrompt) return null;

 return (
 <>
 {showDeferredCheckInBanner && (
 <Card className="mismo-card border-2 border-[var(--color-primary-700)]/40 bg-[var(--mismo-blue-light)]/30 mb-6">
 <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div>
 <p className="font-semibold text-[var(--mismo-text)]">Today&apos;s check-in is still due</p>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
 {isIncidentGate
 ? 'Your daily incident query has not been submitted yet.'
 : `Please complete "${heroPrompt.prompt.title}" when you have a moment.`}
 </p>
 </div>
 <Button className="shrink-0 bg-[var(--mismo-blue)] hover:bg-blue-600 min-h-[44px]" onClick={handleResumeCheckIn}>
 Complete check-in
 </Button>
 </CardContent>
 </Card>
 )}

 {showCheckInGate && (
 <Card className="mismo-card border-2 border-[var(--color-primary-700)] shadow-[var(--shadow-2)] mb-6">
 <CardContent className="p-8 md:p-10">
 <div className="max-w-3xl">
 {financialFollowUp ? (
 financialPayrollChoice ? (
 <>
 <p className="text-xs tracking-[0.08em] uppercase text-[var(--color-text-secondary)]">Pay and compensation screening</p>
 <h2 className="mismo-heading text-2xl md:text-3xl mt-3 text-[var(--color-primary-900)]">{PAYROLL_MEMO_CHOICE_HEADING}</h2>
 <div className="mt-6 space-y-4">
 <Card className="border border-[var(--color-border-200)]">
 <CardContent className="p-5 space-y-3">
 <p className="font-semibold">{PAYROLL_EXPEDITED_QUICK_LABEL}</p>
 <p className="text-sm text-[var(--color-text-secondary)]">{PAYROLL_MEMO_QUICK_DESCRIPTION}</p>
 <Button className="min-h-[44px] bg-[var(--color-primary-900)]" onClick={submitExpeditedPayrollFromCheckIn}>
 Submit payroll issue (no details)
 </Button>
 </CardContent>
 </Card>
 <Card className="border border-[var(--color-border-200)]">
 <CardContent className="p-5 space-y-3">
 <p className="font-semibold">Fill out payroll report sheet</p>
 <p className="text-sm text-[var(--color-text-secondary)]">{PAYROLL_MEMO_FULL_DESCRIPTION}</p>
 <Button variant="outline" className="min-h-[44px]" onClick={submitFullPayrollFromCheckIn}>
 Continue to report sheet
 </Button>
 </CardContent>
 </Card>
 </div>
 <Button type="button" variant="ghost" className="mt-6 text-[var(--mismo-blue)]" onClick={() => setFinancialPayrollChoice(false)}>
 Back
 </Button>
 </>
 ) : (
 <>
 <p className="text-xs tracking-[0.08em] uppercase text-[var(--color-text-secondary)]">
 {isIncidentGate ? 'Check-in required before you continue' : 'Compliance Check-In Required'}
 </p>
 <h2 className="mismo-heading text-2xl md:text-3xl mt-3">Pay and compensation screening</h2>
 <p className="text-base mt-5">{FINANCIAL_SCREENING_QUESTION}</p>
 <p className="text-sm text-[var(--color-text-secondary)] mt-4 border-l-2 border-[var(--color-primary-500)] pl-4">{FINANCIAL_SCREENING_NOTE}</p>
 <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Button variant="outline" className="h-14 border-[var(--color-emerald-600)] text-[var(--color-emerald-600)]" onClick={() => submitFinancialAndClose(false)}>
 No concern
 </Button>
 <Button className="h-14 bg-[var(--color-primary-900)]" onClick={handleFinancialYesConcern}>
 Yes, I have a concern
 </Button>
 </div>
 <Button type="button" variant="ghost" className="mt-6 text-[var(--mismo-blue)]" onClick={cancelFinancialFollowUp}>
 Back to previous step
 </Button>
 </>
 )
 ) : (
 <>
 {checkInStepLabel && <p className="text-sm font-medium text-[var(--color-primary-700)]">{checkInStepLabel}</p>}
 <p className="text-xs tracking-[0.08em] uppercase text-[var(--color-text-secondary)] mt-2">
 {isIncidentGate ? 'Daily check-in required' : 'Compliance Check-In Required'}
 </p>
 {isIncidentGate ? (
 <>
 <p className="text-sm text-[var(--color-text-secondary)] mt-2 tabular-nums">
 {eqcHeaderDate}
 <span className="mx-2">·</span>
 {organizationName}
 </p>
 <h2 className="mismo-heading text-2xl md:text-3xl mt-3">Incident Query</h2>
 {incidentStep === 'question' ? (
 <>
 <p className="text-base mt-5">{EQC_INCIDENT_QUESTION}</p>
 <p className="text-sm text-[var(--color-text-secondary)] mt-4 border-l-2 border-[var(--color-primary-500)] pl-4">
 <span className="font-medium">Note: </span>
 {EQC_RETALIATION_NOTE}
 </p>
 <p className="text-sm text-[var(--color-text-secondary)] mt-6">
 {portal === 'staff'
 ? 'Please answer today\'s incident query before using the Risk Command Center. It stays on your dashboard until you respond.'
 : 'Please answer today\'s incident query. It stays on Home until you respond.'}
 </p>
 <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Button variant="outline" className="h-14 border-[var(--color-emerald-600)] text-[var(--color-emerald-600)]" onClick={() => handleNoIssues(heroPrompt.id)}>
 NO
 </Button>
 <Button className="h-14 bg-[var(--color-primary-900)]" onClick={() => setIncidentStep('yes_confirm')}>
 YES
 </Button>
 </div>
 </>
 ) : (
 <>
 <p className="text-base mt-5">{EQC_CONFIRMATION_BODY}</p>
 <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Button variant="outline" className="h-14" onClick={() => setIncidentStep('question')}>
 Go back
 </Button>
 <Button className="h-14 bg-[var(--color-primary-900)]" onClick={() => handleIncidentYesSubmit(heroPrompt.id)}>
 Submit
 </Button>
 </div>
 </>
 )}
 </>
 ) : (
 <>
 <h2 className="mismo-heading text-3xl mt-2">{heroPrompt.prompt.title}</h2>
 <p className="text-base text-[var(--color-text-secondary)] mt-3">{heroPrompt.prompt.description}</p>
 <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
 <Button variant="outline" className="h-14 border-[var(--color-emerald-600)] text-[var(--color-emerald-600)]" onClick={() => handleNoIssues(heroPrompt.id)}>
 No issues to report
 </Button>
 <Button className="h-14 bg-[var(--color-primary-900)]" onClick={() => handleHaveIssueWithReport(heroPrompt.id, heroPrompt.prompt.id)}>
 I have an issue
 <Icons.arrowRight className="h-4 w-4 ml-2" />
 </Button>
 </div>
 </>
 )}
 </>
 )}
 </div>
 </CardContent>
 </Card>
 )}
 </>
 );
}
