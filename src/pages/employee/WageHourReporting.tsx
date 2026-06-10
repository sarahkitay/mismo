import { useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  WAGE_HOUR_RETALIATION_NOTE,
  WAGE_HOUR_SCREENING_QUESTION,
  WAGE_HOUR_YES_CONFIRMATION_BODY,
  formatCaseReference,
} from '@/lib/caseTypes';
import { toast } from 'sonner';

interface WageHourReportingProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

function formatEqcHeaderDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}.${dd}.${yyyy}`;
}

export function WageHourReporting({ dataStore, onNavigate }: WageHourReportingProps) {
  const { currentUser, recordWageHourScreeningNo, beginWageHourCase, organizationName } = dataStore;
  const [step, setStep] = useState<'screening' | 'yes_confirm' | 'no_ack'>('screening');

  const handleNo = () => {
    recordWageHourScreeningNo(currentUser.id);
    setStep('no_ack');
    toast.success('Your response has been recorded. No case was created.');
  };

  const handleYesContinue = () => {
    setStep('yes_confirm');
  };

  const handleYesSubmit = () => {
    const report = beginWageHourCase(currentUser.id, 'WAGE_HOUR_PROMPT');
    const ref = formatCaseReference(report);
    toast.success(
      `Your response is recorded (${ref}). HR has been notified (simulated email to you and your administrator). Complete the intake form next.`,
      { duration: 8000 }
    );
    onNavigate(`wage-hour-intake/${report.id}`);
  };

  if (step === 'no_ack') {
    return (
      <div className="space-y-6 max-w-2xl">
        <Button variant="ghost" className="px-0" onClick={() => onNavigate('home')}>
          <Icons.arrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-4 sm:p-6 space-y-3">
            <p className="font-semibold text-[var(--mismo-text)]">Response recorded</p>
            <p className="text-sm text-[var(--mismo-text-secondary)] leading-relaxed">
              Thank you. Your acknowledgement has been securely logged with a timestamp. No wage &amp; hour case was created.
            </p>
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              If your situation changes, you can return to <strong>Wage &amp; hour</strong> from your dashboard or sidebar at any time.
            </p>
            <Button className="mt-2 min-h-[44px] bg-[var(--mismo-blue)]" onClick={() => onNavigate('home')}>
              Return to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl pb-6">
      <Button variant="ghost" className="px-0" onClick={() => onNavigate('home')}>
        <Icons.arrowLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Button>

      <Card className="mismo-card border-2 border-emerald-700/30 shadow-[var(--shadow-2)]">
        <CardContent className="p-4 sm:p-8 md:p-10">
          <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
            {formatEqcHeaderDate(new Date())}
            <span className="mx-2">·</span>
            {organizationName}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 mt-3">Protected reporting</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-[var(--color-primary-900)] mt-1">Wage &amp; Hour Query</h1>

          {step === 'screening' ? (
            <>
              <p className="text-base md:text-lg text-[var(--color-text-primary)] mt-5 leading-relaxed">
                {WAGE_HOUR_SCREENING_QUESTION}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed border-l-2 border-emerald-600 pl-4">
                {WAGE_HOUR_RETALIATION_NOTE}
              </p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Button
                  variant="outline"
                  className="min-h-[44px] h-14 text-base border-[var(--color-emerald-600)] text-[var(--color-emerald-700)]"
                  onClick={handleNo}
                >
                  No, I do not
                </Button>
                <Button
                  className="min-h-[44px] h-14 text-base bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)]"
                  onClick={handleYesContinue}
                >
                  Yes, I have a concern
                </Button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-4">
                If you selected &quot;Yes&quot; by mistake, you can go back before submitting the intake form. Once submitted, changes are version-tracked for compliance.
              </p>
            </>
          ) : (
            <>
              <p className="text-base md:text-lg text-[var(--color-text-primary)] mt-5 leading-relaxed">
                {WAGE_HOUR_YES_CONFIRMATION_BODY}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed border-l-2 border-emerald-600 pl-4">
                {WAGE_HOUR_RETALIATION_NOTE}
              </p>
              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Button variant="outline" className="min-h-[44px] h-14 text-base" onClick={() => setStep('screening')}>
                  Back
                </Button>
                <Button
                  className="min-h-[44px] h-14 text-base bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)]"
                  onClick={handleYesSubmit}
                >
                  Submit &amp; continue
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
