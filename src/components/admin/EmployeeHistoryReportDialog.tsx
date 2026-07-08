import type { User } from '@/types';
import type { EmployeePromptRegisterRow } from '@/lib/employeePromptRegister';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatDate, formatPercent, formatRelativeTime } from '@/lib/utils';

export type EmployeeHistoryTimelineItem = {
  id: string;
  at: Date;
  label: string;
  detail?: string;
  section?: string;
};

interface EmployeeHistoryReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: User;
  engagement?: {
    lastResponseAt?: Date;
    responseRate30d: number;
    pendingPrompts: number;
    isAtRisk?: boolean;
  };
  promptRows: EmployeePromptRegisterRow[];
  caseCount: number;
  openInvestigations: number;
  memoAckRate: number;
  outreachCount: number;
  timeline: EmployeeHistoryTimelineItem[];
  onExportCsv: () => void;
  onOpenCheckInRegister: () => void;
  onOpenProfileTab?: (tab: string) => void;
}

export function EmployeeHistoryReportDialog({
  open,
  onOpenChange,
  employee,
  engagement,
  promptRows,
  caseCount,
  openInvestigations,
  memoAckRate,
  outreachCount,
  timeline,
  onExportCsv,
  onOpenCheckInRegister,
  onOpenProfileTab,
}: EmployeeHistoryReportDialogProps) {
  const pendingCheckIns = promptRows.filter((r) => r.answer === 'UNANSWERED').length;
  const yesResponses = promptRows.filter((r) => r.answer === 'HAS_ISSUE').length;
  const noResponses = promptRows.filter((r) => r.answer === 'NO_ISSUE').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Employee history report - {employee.firstName} {employee.lastName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-[var(--color-text-secondary)]">
          Overview of check-ins, cases, investigations, memos, and outreach for this employee. Export the full history
          as CSV for audits or internal reporting.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Pending check-ins" value={pendingCheckIns || engagement?.pendingPrompts || 0} />
          <Stat label="Yes responses" value={yesResponses} />
          <Stat label="Cases filed" value={caseCount} />
          <Stat label="Open investigations" value={openInvestigations} />
          <Stat label="Memo ack rate" value={formatPercent(memoAckRate)} />
          <Stat label="Response rate (30d)" value={formatPercent(engagement?.responseRate30d ?? 0)} />
          <Stat label="Outreach logged" value={outreachCount} />
          <Stat
            label="Risk status"
            value={engagement?.isAtRisk ? 'At risk' : 'Normal'}
            accent={engagement?.isAtRisk ? 'text-[var(--color-alert-600)]' : undefined}
          />
        </div>

        <div className="rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-3 text-sm space-y-1">
          <p>
            <span className="font-medium">Employee ID:</span> {employee.employeeId?.trim() || '-'}
          </p>
          <p>
            <span className="font-medium">Email:</span> {employee.email}
          </p>
          <p>
            <span className="font-medium">Hire date:</span> {employee.hiredDate ? formatDate(employee.hiredDate) : '-'}
          </p>
          <p>
            <span className="font-medium">Last check-in response:</span>{' '}
            {engagement?.lastResponseAt ? formatRelativeTime(engagement.lastResponseAt) : 'Never'}
          </p>
          <p>
            <span className="font-medium">Check-in summary:</span> {yesResponses} Yes · {noResponses} No ·{' '}
            {pendingCheckIns} pending
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-[var(--mismo-text)]">Recent history</h3>
            <Button type="button" variant="ghost" size="sm" onClick={onOpenCheckInRegister}>
              Open check-in register
            </Button>
          </div>
          {timeline.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No history recorded yet.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto border border-[var(--color-border-200)] rounded-md p-3">
              {timeline.slice(0, 20).map((item) => (
                <li key={item.id} className="text-sm border-b border-[var(--color-border-200)] pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium text-[var(--mismo-text)]">{item.label}</span>
                    <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                      {formatRelativeTime(item.at)}
                    </span>
                  </div>
                  {item.detail && (
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">{item.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {onOpenProfileTab && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenProfileTab('reports')}>
              View cases
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenProfileTab('prompts')}>
              View check-ins
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenProfileTab('investigations')}>
              View investigations
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenProfileTab('outreach')}>
              View outreach
            </Button>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={onExportCsv}>
            Export full history (CSV)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-md border border-[var(--color-border-200)] p-3 bg-white">
      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className={`text-lg font-semibold tabular-nums mt-1 ${accent ?? 'text-[var(--mismo-text)]'}`}>{value}</p>
    </div>
  );
}
