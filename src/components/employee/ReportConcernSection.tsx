import { Icons } from '@/lib/icons';
import { Card, CardContent } from '@/components/ui/card';

interface ReportConcernSectionProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
  compact?: boolean;
}

export function ReportConcernSection({ onNavigate, compact }: ReportConcernSectionProps) {
  return (
    <section className="report-concern-section" aria-labelledby="report-concern-heading">
      <div className={compact ? 'mb-3' : 'mb-4'}>
        <h2 id="report-concern-heading" className="text-lg font-semibold text-[var(--mismo-text)]">
          Report a concern
        </h2>
        <p className="text-sm text-[var(--mismo-text-secondary)] mt-1 max-w-2xl">
          Protected reporting channels for workplace and compensation concerns. Your submissions are confidential, logged securely, and reviewed by authorized personnel only.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        <Card
          className="mismo-card border-2 border-[var(--color-border-200)] hover:border-[var(--color-primary-700)] active:scale-[0.99] transition-all cursor-pointer group touch-manipulation"
          onClick={() => onNavigate('report-new')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('report-new');
            }
          }}
          role="button"
          tabIndex={0}
        >
          <CardContent className="p-5 sm:p-6 flex flex-col h-full">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-[var(--color-primary-900)]/10 flex items-center justify-center shrink-0 group-hover:bg-[var(--color-primary-900)]/15 transition-colors">
                <Icons.shield className="h-5 w-5 text-[var(--color-primary-900)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Primary channel</p>
                <h3 className="text-base font-semibold text-[var(--mismo-text)] mt-0.5">Report workplace concern</h3>
                <p className="text-sm text-[var(--mismo-text-secondary)] mt-2 leading-relaxed">
                  Harassment, discrimination, retaliation, safety, ethics, manager conduct, policy violations, and other HR concerns.
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-4 pt-4 border-t border-[var(--color-border-200)]">
              Retaliation for good-faith reporting is prohibited.
            </p>
          </CardContent>
        </Card>

        <Card
          className="mismo-card border-2 border-[var(--color-border-200)] hover:border-emerald-700/40 active:scale-[0.99] transition-all cursor-pointer group touch-manipulation"
          onClick={() => onNavigate('wage-hour-report')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('wage-hour-report');
            }
          }}
          role="button"
          tabIndex={0}
        >
          <CardContent className="p-5 sm:p-6 flex flex-col h-full">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
                <Icons.reports className="h-5 w-5 text-emerald-800" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Protected rights</p>
                <h3 className="text-base font-semibold text-[var(--mismo-text)] mt-0.5">Report wage &amp; hour concern</h3>
                <p className="text-sm text-[var(--mismo-text-secondary)] mt-2 leading-relaxed">
                  Pay, overtime, hours worked, deductions, classification, breaks, benefits calculations, and compensation disputes.
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-4 pt-4 border-t border-[var(--color-border-200)]">
              Wage reporting is a protected employee right.
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
