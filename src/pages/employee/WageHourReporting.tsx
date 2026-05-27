import { useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  WAGE_HOUR_RETALIATION_NOTE,
  WAGE_HOUR_SCREENING_QUESTION,
} from '@/lib/caseTypes';
import { toast } from 'sonner';

interface WageHourReportingProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function WageHourReporting({ dataStore, onNavigate }: WageHourReportingProps) {
  const { currentUser, recordWageHourScreeningNo, beginWageHourCase } = dataStore;
  const [step, setStep] = useState<'screening' | 'no_ack'>('screening');

  const handleNo = () => {
    recordWageHourScreeningNo(currentUser.id);
    setStep('no_ack');
    toast.success('Your response has been recorded. No case was created.');
  };

  const handleYes = () => {
    const report = beginWageHourCase(currentUser.id);
    toast.info('Your protected concern has been opened. Complete the intake form to submit details.', { duration: 6000 });
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
          <CardContent className="p-6 space-y-3">
            <p className="font-semibold text-[var(--mismo-text)]">Response recorded</p>
            <p className="text-sm text-[var(--mismo-text-secondary)] leading-relaxed">
              Thank you. Your acknowledgement has been securely logged with a timestamp. No wage &amp; hour case was created.
            </p>
            <p className="text-sm text-[var(--mismo-text-secondary)]">
              If your situation changes, you can return to <strong>Wage &amp; Hour Question</strong> at any time from your dashboard or sidebar.
            </p>
            <Button className="mt-2 bg-[var(--mismo-blue)]" onClick={() => onNavigate('home')}>
              Return to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" className="px-0" onClick={() => onNavigate('home')}>
        <Icons.arrowLeft className="h-4 w-4 mr-2" />
        Back to Home
      </Button>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Protected reporting</p>
        <h1 className="text-2xl font-bold text-[var(--mismo-text)] mt-1">Wage &amp; hour question</h1>
        <p className="text-sm text-[var(--mismo-text-secondary)] mt-2">
          This channel is permanently available for compensation, hours, and payroll concerns.
        </p>
      </div>

      <Card className="mismo-card border-2 border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white">
        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="space-y-3">
            <p className="text-base sm:text-lg font-medium text-[var(--mismo-text)] leading-relaxed">{WAGE_HOUR_SCREENING_QUESTION}</p>
            <p className="text-sm text-[var(--mismo-text-secondary)] leading-relaxed border-l-2 border-emerald-600/40 pl-4">
              {WAGE_HOUR_RETALIATION_NOTE}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              className="flex-1 bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)] h-12 text-base"
              onClick={handleYes}
            >
              Yes, I have a concern
            </Button>
            <Button variant="outline" className="flex-1 h-12 text-base" onClick={handleNo}>
              No, I do not
            </Button>
          </div>

          <p className="text-xs text-[var(--color-text-muted)]">
            If you selected &quot;Yes&quot; by mistake, you can go back before submitting the intake form. Once submitted, changes are version-tracked for compliance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
