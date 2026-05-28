import { useEffect, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { EmployeeOnboardingKind } from '@/types';
import { Button } from '@/components/ui/button';
import {
  WAGE_HOUR_RETALIATION_NOTE,
  WAGE_HOUR_SCREENING_QUESTION,
  WAGE_HOUR_YES_CONFIRMATION_BODY,
} from '@/lib/caseTypes';
import { formatCaseReference } from '@/lib/caseTypes';
import { getOnboardingDelivery } from '@/lib/employeeOnboarding';
import { toast } from 'sonner';

const EQC_INCIDENT_QUESTION =
  "Have you experienced or witnessed an incident or occurrence which you perceive to be a violation of your or your co-worker's employment rights that you have not reported prior to this question.";

const EQC_RETALIATION_NOTE =
  'You will not be retaliated against for sharing a concern in good faith. Retaliation is against the law and is not tolerated by this company.';

const EQC_CONFIRMATION_BODY =
  'Thank you for letting us know. Your response will be reviewed by the appropriate HR contact. If this was selected by mistake, you can go back and update your answer before submitting.';

function formatEqcHeaderDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}.${dd}.${yyyy}`;
}

interface EmployeeOnboardingFlowProps {
  dataStore: DataStore;
  onComplete: () => void;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function EmployeeOnboardingFlow({ dataStore, onComplete, onNavigate }: EmployeeOnboardingFlowProps) {
  const {
    pendingOnboardingSteps,
    markOnboardingExposed,
    organizationName,
    submitPromptResponse,
    submitIncidentPromptYes,
    recordWageHourScreeningNo,
    beginWageHourCase,
    deliveries,
  } = dataStore;

  const step: EmployeeOnboardingKind | null = pendingOnboardingSteps[0] ?? null;
  const [incidentSubStep, setIncidentSubStep] = useState<'question' | 'yes_confirm'>('question');
  const [wageSubStep, setWageSubStep] = useState<'screening' | 'yes_confirm'>('screening');

  const incidentDelivery = getOnboardingDelivery('INCIDENT', dataStore.currentUser.id, deliveries);
  const eqcHeaderDate = formatEqcHeaderDate(new Date());

  useEffect(() => {
    if (step === 'INCIDENT') {
      markOnboardingExposed('INCIDENT');
      setIncidentSubStep('question');
    } else if (step === 'WAGE_HOUR') {
      markOnboardingExposed('WAGE_HOUR');
      setWageSubStep('screening');
    }
  }, [step, markOnboardingExposed]);

  useEffect(() => {
    if (pendingOnboardingSteps.length === 0) {
      onComplete();
    }
  }, [pendingOnboardingSteps.length, onComplete]);

  if (!step) {
    return <div className="min-h-screen bg-white" />;
  }

  const handleIncidentNo = () => {
    const deliveryId = incidentDelivery?.id;
    if (!deliveryId) return;
    submitPromptResponse(deliveryId, 'NO_ISSUE');
    toast.success('Your response has been recorded. No further action is needed for this check-in.');
  };

  const handleIncidentYesSubmit = () => {
    const deliveryId = incidentDelivery?.id;
    if (!deliveryId) return;
    const result = submitIncidentPromptYes(deliveryId);
    setIncidentSubStep('question');
    if (result) {
      toast.success(
        'Thank you. Your response is recorded. You will complete the incident form after these required check-ins.',
        { duration: 7000 }
      );
    }
  };

  const handleWageHourNo = () => {
    recordWageHourScreeningNo(dataStore.currentUser.id);
    toast.success('Your response has been recorded. No wage & hour case was created.');
  };

  const handleWageHourYesSubmit = () => {
    const report = beginWageHourCase(dataStore.currentUser.id, 'WAGE_HOUR_PROMPT');
    const ref = formatCaseReference(report);
    toast.success(`Your response is recorded (${ref}).`, { duration: 6000 });
    onComplete();
    onNavigate(`wage-hour-intake/${report.id}`);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-3xl">
          {step === 'INCIDENT' ? (
            <>
              <p className="text-xs tracking-[0.08em] uppercase text-[var(--color-text-secondary)]">
                Check-in required before you continue
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-2 tabular-nums">
                {eqcHeaderDate}
                <span className="mx-2 text-[var(--color-border-200)]">·</span>
                {organizationName}
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-primary-900)] mt-3">Incident Query</h1>

              {incidentSubStep === 'question' ? (
                <>
                  <p className="text-base md:text-lg text-[var(--color-text-primary)] mt-5 leading-relaxed">{EQC_INCIDENT_QUESTION}</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed border-l-2 border-[var(--color-primary-500)] pl-4">
                    <span className="font-medium text-[var(--color-text-primary)]">Note: </span>
                    {EQC_RETALIATION_NOTE}
                  </p>
                  <p className="text-sm font-medium text-[var(--color-text-primary)] mt-6">
                    A response is required to continue using the application.
                  </p>
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                    <Button
                      variant="outline"
                      className="h-14 text-base border-[var(--color-emerald-600)] text-[var(--color-emerald-700)]"
                      onClick={handleIncidentNo}
                    >
                      NO
                    </Button>
                    <Button
                      className="h-14 text-base bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)]"
                      onClick={() => setIncidentSubStep('yes_confirm')}
                    >
                      YES
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-base md:text-lg text-[var(--color-text-primary)] mt-5 leading-relaxed">{EQC_CONFIRMATION_BODY}</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed border-l-2 border-[var(--color-primary-500)] pl-4">
                    <span className="font-medium text-[var(--color-text-primary)]">Note: </span>
                    {EQC_RETALIATION_NOTE}
                  </p>
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                    <Button variant="outline" className="h-14 text-base" onClick={() => setIncidentSubStep('question')}>
                      BACK
                    </Button>
                    <Button
                      className="h-14 text-base bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)]"
                      onClick={handleIncidentYesSubmit}
                      disabled={!incidentDelivery}
                    >
                      SUBMIT
                    </Button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <p className="text-xs tracking-[0.08em] uppercase text-[var(--color-text-secondary)]">
                Check-in required before you continue
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-2 tabular-nums">
                {eqcHeaderDate}
                <span className="mx-2 text-[var(--color-border-200)]">·</span>
                {organizationName}
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-primary-900)] mt-3">Wage &amp; Hour Query</h1>

              {wageSubStep === 'screening' ? (
                <>
                  <p className="text-base md:text-lg text-[var(--color-text-primary)] mt-5 leading-relaxed">{WAGE_HOUR_SCREENING_QUESTION}</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed border-l-2 border-emerald-600 pl-4">
                    {WAGE_HOUR_RETALIATION_NOTE}
                  </p>
                  <p className="text-sm font-medium text-[var(--color-text-primary)] mt-6">
                    A response is required to continue using the application.
                  </p>
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                    <Button
                      variant="outline"
                      className="h-14 text-base border-[var(--color-emerald-600)] text-[var(--color-emerald-700)]"
                      onClick={handleWageHourNo}
                    >
                      NO
                    </Button>
                    <Button
                      className="h-14 text-base bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)]"
                      onClick={() => setWageSubStep('yes_confirm')}
                    >
                      YES
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-base md:text-lg text-[var(--color-text-primary)] mt-5 leading-relaxed">{WAGE_HOUR_YES_CONFIRMATION_BODY}</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed border-l-2 border-emerald-600 pl-4">
                    {WAGE_HOUR_RETALIATION_NOTE}
                  </p>
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
                    <Button variant="outline" className="h-14 text-base" onClick={() => setWageSubStep('screening')}>
                      BACK
                    </Button>
                    <Button
                      className="h-14 text-base bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)]"
                      onClick={handleWageHourYesSubmit}
                    >
                      SUBMIT
                    </Button>
                  </div>
                </>
              )}
            </>
          )}

          {pendingOnboardingSteps.length > 1 && (
            <p className="text-xs text-[var(--color-text-muted)] mt-10">
              Step {step === 'INCIDENT' ? 1 : 2} of {pendingOnboardingSteps.length} required check-ins
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
