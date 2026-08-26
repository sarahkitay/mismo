import { useState } from 'react';
import type { PromptAnswer } from '@/types';
import type { DataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { resolveDailyCheckInPrompt } from '@/lib/corePrompts';
import { useDailyCheckInViewState, type DailyCheckInPortal } from '@/components/DailyCheckInGate';
import {
  PAYROLL_EXPEDITED_EMPLOYEE_MESSAGE,
  PAYROLL_EXPEDITED_QUICK_LABEL,
  PAYROLL_MEMO_CHOICE_HEADING,
  PAYROLL_MEMO_FULL_DESCRIPTION,
  PAYROLL_MEMO_QUICK_DESCRIPTION,
  WAGE_HOUR_RETALIATION_NOTE,
  WAGE_HOUR_SCREENING_QUESTION,
  WAGE_HOUR_YES_CONFIRMATION_BODY,
  formatCaseReference,
} from '@/lib/caseTypes';
import { toast } from 'sonner';

const EQC_INCIDENT_QUESTION =
  "Have you experienced or witnessed an incident or occurrence which you perceive to be a violation of your or your co-worker's employment rights that you have not reported prior to this question.";

const EQC_RETALIATION_NOTE =
  'You will not be retaliated against for sharing a concern in good faith. Retaliation is against the law and is not tolerated by this company.';

const EQC_CONFIRMATION_BODY =
  "Mismo will relay your response to the individuals designated by the company to receive it. You will be contacted to discuss the circumstances surrounding your response in the very near future, pursuant to the company's policy.";

const FINANCIAL_SCREENING_QUESTION =
  'Are you aware of any issue related to pay, bonuses, reimbursements, benefits, or other compensation that you believe may be incorrect, withheld without proper explanation, or inconsistent with company policy or applicable law?';

type IncidentStep = 'question' | 'yes_confirm' | 'financial' | 'payroll_choice';
type WageStep = 'question' | 'yes_confirm' | 'payroll_choice';

interface DashboardCheckInShortcutsProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  portal: DailyCheckInPortal;
}

export function DashboardCheckInShortcuts({ dataStore, onNavigate, portal }: DashboardCheckInShortcutsProps) {
  const {
    currentUser,
    prompts,
    session,
    organizationName,
    ensureVoluntaryCheckInDelivery,
    submitPromptResponse,
    submitIncidentPromptYes,
    submitExpeditedPayrollReport,
    beginWageHourCase,
    recordWageHourScreeningNo,
  } = dataStore;

  const { showCheckInGate } = useDailyCheckInViewState(dataStore);
  const incidentPrompt = session ? resolveDailyCheckInPrompt(prompts, session.orgId) : undefined;

  const [incidentDeliveryId, setIncidentDeliveryId] = useState<string | null>(null);
  const [incidentStep, setIncidentStep] = useState<IncidentStep>('question');
  const [incidentFinancialAnswer, setIncidentFinancialAnswer] = useState<PromptAnswer | null>(null);

  const [wageStep, setWageStep] = useState<WageStep>('question');

  if (showCheckInGate || !incidentPrompt) return null;

  const wantsFinancialFollowUp = Boolean(incidentPrompt.includeFinancialQuestion);

  const resetIncidentFlow = () => {
    setIncidentDeliveryId(null);
    setIncidentStep('question');
    setIncidentFinancialAnswer(null);
  };

  const resetWageFlow = () => {
    setWageStep('question');
  };

  const ensureIncidentDelivery = (): string | null => {
    if (incidentDeliveryId) return incidentDeliveryId;
    const delivery = ensureVoluntaryCheckInDelivery(incidentPrompt.id);
    if (!delivery) {
      toast.error('Could not start a new check-in response.');
      return null;
    }
    setIncidentDeliveryId(delivery.id);
    return delivery.id;
  };

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

  const submitIncidentFinancial = async (hasPayConcern: boolean) => {
    const deliveryId = incidentDeliveryId;
    if (!deliveryId || !incidentFinancialAnswer) return;
    const note = hasPayConcern
      ? 'Financial follow-up: employee indicated a pay, compensation, or benefits-related concern.'
      : 'Financial follow-up: no pay, compensation, or benefits-related concern indicated.';

    if (incidentFinancialAnswer === 'HAS_ISSUE') {
      try {
        const result = await submitIncidentPromptYes(deliveryId, note);
        resetIncidentFlow();
        if (result) {
          toast.success(
            `Response recorded and a secure case has been opened (${formatCaseReference(result.report)}).`,
            { duration: 7000 }
          );
          goToReport(result.report.id);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not open incident case.');
      }
      return;
    }

    submitPromptResponse(deliveryId, 'NO_ISSUE', note);
    resetIncidentFlow();
    toast.success('Your response has been recorded. No further action is needed for this check-in.');
  };

  const handleIncidentNo = () => {
    const deliveryId = ensureIncidentDelivery();
    if (!deliveryId) return;
    if (wantsFinancialFollowUp) {
      setIncidentFinancialAnswer('NO_ISSUE');
      setIncidentStep('financial');
      return;
    }
    submitPromptResponse(deliveryId, 'NO_ISSUE');
    resetIncidentFlow();
    toast.success('Your response has been recorded.');
  };

  const handleIncidentYes = () => {
    const deliveryId = ensureIncidentDelivery();
    if (!deliveryId) return;
    setIncidentStep('yes_confirm');
  };

  const handleIncidentYesSubmit = async () => {
    const deliveryId = incidentDeliveryId;
    if (!deliveryId) return;
    if (wantsFinancialFollowUp) {
      setIncidentFinancialAnswer('HAS_ISSUE');
      setIncidentStep('financial');
      return;
    }
    try {
      const result = await submitIncidentPromptYes(deliveryId);
      resetIncidentFlow();
      if (result) {
        toast.success(
          `Response recorded. Complete intake to add details (${formatCaseReference(result.report)}).`,
          { duration: 7000 }
        );
        goToReport(result.report.id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open incident case.');
    }
  };

  const submitExpeditedPayrollFromPanel = async () => {
    const deliveryId = incidentDeliveryId;
    try {
      const report = await submitExpeditedPayrollReport(currentUser.id, {
        deliveryId: deliveryId ?? undefined,
        promptId: incidentPrompt.id,
        sourceType: 'EMPLOYEE_PROMPT_RESPONSE',
      });
      resetIncidentFlow();
      toast.success(PAYROLL_EXPEDITED_EMPLOYEE_MESSAGE, { duration: 9000 });
      toast.message(`Reference ${formatCaseReference(report)}`, { duration: 5000 });
      if (portal === 'staff') onNavigate('report-detail', { id: report.id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit payroll report.');
    }
  };

  const submitFullPayrollFromPanel = async () => {
    const deliveryId = incidentDeliveryId;
    if (deliveryId) {
      submitPromptResponse(
        deliveryId,
        incidentFinancialAnswer ?? 'HAS_ISSUE',
        'Financial follow-up: employee chose to complete the full wage & hour report sheet.'
      );
    }
    try {
      const report = await beginWageHourCase(currentUser.id, 'EMPLOYEE_PROMPT_RESPONSE');
      resetIncidentFlow();
      toast.success(`Complete the report sheet to submit details (${formatCaseReference(report)}).`, { duration: 7000 });
      goToWageHour(report.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open wage & hour case.');
    }
  };

  const handleWageNo = () => {
    recordWageHourScreeningNo(currentUser.id);
    resetWageFlow();
    toast.success('Your response has been recorded. No case was created.');
  };

  const handleWageYesSubmit = async () => {
    if (portal === 'staff') {
      try {
        const report = await beginWageHourCase(currentUser.id, 'WAGE_HOUR_PROMPT');
        resetWageFlow();
        toast.success(`Response recorded (${formatCaseReference(report)}).`, { duration: 7000 });
        onNavigate('report-detail', { id: report.id });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not open wage & hour case.');
      }
      return;
    }
    setWageStep('payroll_choice');
  };

  const handleWageExpedited = async () => {
    try {
      const report = await submitExpeditedPayrollReport(currentUser.id, { sourceType: 'WAGE_HOUR_PROMPT' });
      resetWageFlow();
      toast.success(PAYROLL_EXPEDITED_EMPLOYEE_MESSAGE, { duration: 9000 });
      toast.message(`Reference ${formatCaseReference(report)}`, { duration: 5000 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit payroll report.');
    }
  };

  const handleWageFullSheet = async () => {
    try {
      const report = await beginWageHourCase(currentUser.id, 'WAGE_HOUR_PROMPT');
      resetWageFlow();
      toast.success(`Your response is recorded (${formatCaseReference(report)}). Complete the intake form next.`, {
        duration: 8000,
      });
      goToWageHour(report.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open wage & hour case.');
    }
  };

  return (
    <section className="border-t border-[var(--color-border-200)] pt-6" aria-labelledby="dashboard-checkin-shortcuts-heading">
      <div className="mb-4">
        <h2 id="dashboard-checkin-shortcuts-heading" className="text-lg font-semibold text-[var(--mismo-text)]">
          Check in again today
        </h2>
        <p className="text-sm text-[var(--mismo-text-secondary)] mt-1 max-w-2xl">
          You can submit another response even if you already completed today&apos;s check-in. Each answer is logged
          separately for {organizationName}.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Daily check-in</p>
              <h3 className="text-base font-semibold text-[var(--mismo-text)] mt-1">Incident Query</h3>
            </div>

            {incidentStep === 'question' && (
              <>
                <p className="text-sm text-[var(--mismo-text-secondary)] leading-relaxed">{EQC_INCIDENT_QUESTION}</p>
                <p className="text-xs text-[var(--mismo-text-secondary)] border-l-2 border-[var(--color-primary-500)] pl-3">
                  {EQC_RETALIATION_NOTE}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="min-h-[44px]" onClick={handleIncidentNo}>
                    No
                  </Button>
                  <Button className="min-h-[44px] bg-[var(--color-primary-900)]" onClick={handleIncidentYes}>
                    Yes
                  </Button>
                </div>
              </>
            )}

            {incidentStep === 'yes_confirm' && (
              <>
                <p className="text-sm text-[var(--mismo-text-secondary)] leading-relaxed">{EQC_CONFIRMATION_BODY}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="min-h-[44px]" onClick={() => setIncidentStep('question')}>
                    Go back
                  </Button>
                  <Button className="min-h-[44px] bg-[var(--color-primary-900)]" onClick={handleIncidentYesSubmit}>
                    Submit
                  </Button>
                </div>
              </>
            )}

            {incidentStep === 'financial' && (
              <>
                <p className="text-sm text-[var(--mismo-text-secondary)] leading-relaxed">{FINANCIAL_SCREENING_QUESTION}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="min-h-[44px]" onClick={() => submitIncidentFinancial(false)}>
                    No concern
                  </Button>
                  <Button className="min-h-[44px] bg-[var(--color-primary-900)]" onClick={() => {
                    if (incidentFinancialAnswer === 'HAS_ISSUE') {
                      void submitIncidentFinancial(true);
                    } else {
                      setIncidentStep('payroll_choice');
                    }
                  }}>
                    Yes, I have a concern
                  </Button>
                </div>
                <Button type="button" variant="ghost" className="px-0 text-[var(--mismo-blue)]" onClick={resetIncidentFlow}>
                  Cancel
                </Button>
              </>
            )}

            {incidentStep === 'payroll_choice' && (
              <>
                <p className="font-semibold text-[var(--mismo-text)]">{PAYROLL_MEMO_CHOICE_HEADING}</p>
                <div className="space-y-3">
                  <div className="rounded-[var(--radius-small)] border border-[var(--color-border-200)] p-4 space-y-2">
                    <p className="text-sm font-medium">{PAYROLL_EXPEDITED_QUICK_LABEL}</p>
                    <p className="text-xs text-[var(--mismo-text-secondary)]">{PAYROLL_MEMO_QUICK_DESCRIPTION}</p>
                    <Button className="min-h-[44px] bg-[var(--color-primary-900)]" onClick={submitExpeditedPayrollFromPanel}>
                      Submit payroll issue (no details)
                    </Button>
                  </div>
                  <div className="rounded-[var(--radius-small)] border border-[var(--color-border-200)] p-4 space-y-2">
                    <p className="text-sm font-medium">Fill out payroll report sheet</p>
                    <p className="text-xs text-[var(--mismo-text-secondary)]">{PAYROLL_MEMO_FULL_DESCRIPTION}</p>
                    <Button variant="outline" className="min-h-[44px]" onClick={submitFullPayrollFromPanel}>
                      Continue to report sheet
                    </Button>
                  </div>
                </div>
                <Button type="button" variant="ghost" className="px-0 text-[var(--mismo-blue)]" onClick={() => setIncidentStep('financial')}>
                  Back
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Protected rights</p>
              <h3 className="text-base font-semibold text-[var(--mismo-text)] mt-1">Pay &amp; compensation screening</h3>
            </div>

            {wageStep === 'question' && (
              <>
                <p className="text-sm text-[var(--mismo-text-secondary)] leading-relaxed">{WAGE_HOUR_SCREENING_QUESTION}</p>
                <p className="text-xs text-[var(--mismo-text-secondary)] border-l-2 border-emerald-600/50 pl-3">
                  {WAGE_HOUR_RETALIATION_NOTE}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="min-h-[44px]" onClick={handleWageNo}>
                    No
                  </Button>
                  <Button className="min-h-[44px] bg-[var(--color-primary-900)]" onClick={() => setWageStep('yes_confirm')}>
                    Yes
                  </Button>
                </div>
              </>
            )}

            {wageStep === 'yes_confirm' && (
              <>
                <p className="text-sm text-[var(--mismo-text-secondary)] leading-relaxed">{WAGE_HOUR_YES_CONFIRMATION_BODY}</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="min-h-[44px]" onClick={() => setWageStep('question')}>
                    Go back
                  </Button>
                  <Button className="min-h-[44px] bg-[var(--color-primary-900)]" onClick={handleWageYesSubmit}>
                    Submit
                  </Button>
                </div>
              </>
            )}

            {wageStep === 'payroll_choice' && portal === 'employee' && (
              <>
                <p className="font-semibold text-[var(--mismo-text)]">{PAYROLL_MEMO_CHOICE_HEADING}</p>
                <div className="space-y-3">
                  <div className="rounded-[var(--radius-small)] border border-[var(--color-border-200)] p-4 space-y-2">
                    <p className="text-sm font-medium">{PAYROLL_EXPEDITED_QUICK_LABEL}</p>
                    <p className="text-xs text-[var(--mismo-text-secondary)]">{PAYROLL_MEMO_QUICK_DESCRIPTION}</p>
                    <Button className="min-h-[44px] bg-[var(--color-primary-900)]" onClick={handleWageExpedited}>
                      Submit payroll issue (no details)
                    </Button>
                  </div>
                  <div className="rounded-[var(--radius-small)] border border-[var(--color-border-200)] p-4 space-y-2">
                    <p className="text-sm font-medium">Fill out payroll report sheet</p>
                    <p className="text-xs text-[var(--mismo-text-secondary)]">{PAYROLL_MEMO_FULL_DESCRIPTION}</p>
                    <Button variant="outline" className="min-h-[44px]" onClick={handleWageFullSheet}>
                      Continue to report sheet
                    </Button>
                  </div>
                </div>
                <Button type="button" variant="ghost" className="px-0 text-[var(--mismo-blue)]" onClick={() => setWageStep('yes_confirm')}>
                  Back
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
