import type { DataStore } from '@/hooks/useDataStore';
import type { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatDate, formatPercent } from '@/lib/utils';

interface InvestigationPersonDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function InvestigationPersonDrawer({
  open,
  onOpenChange,
  user,
  dataStore,
  onNavigate,
}: InvestigationPersonDrawerProps) {
  if (!user) return null;

  const engagement = dataStore.getEmployeeEngagement(user.id);
  const reports = dataStore.reports.filter((r) => r.createdByUserId === user.id);
  const invCount = dataStore.investigations.filter(
    (i) =>
      i.subjectUserIds?.includes(user.id) ||
      i.witnessUserIds?.includes(user.id) ||
      i.persons?.some((p) => p.userId === user.id)
  ).length;
  const memoAcks = dataStore.policyAcknowledgements.filter((a) => a.userId === user.id);
  const responses = dataStore.responses.filter((r) => r.userId === user.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {user.firstName} {user.lastName}
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm">
          <p className="text-[var(--color-text-secondary)]">{user.email}</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-[var(--color-border-200)] p-2">
              <p className="text-xs text-[var(--color-text-muted)]">Reports</p>
              <p className="font-semibold">{reports.length}</p>
            </div>
            <div className="border border-[var(--color-border-200)] p-2">
              <p className="text-xs text-[var(--color-text-muted)]">Investigations</p>
              <p className="font-semibold">{invCount}</p>
            </div>
            <div className="border border-[var(--color-border-200)] p-2">
              <p className="text-xs text-[var(--color-text-muted)]">Prompt responses</p>
              <p className="font-semibold">{responses.length}</p>
            </div>
            <div className="border border-[var(--color-border-200)] p-2">
              <p className="text-xs text-[var(--color-text-muted)]">Memo acks</p>
              <p className="font-semibold">{memoAcks.length}</p>
            </div>
          </div>
          <div className="border border-[var(--color-border-200)] p-3 space-y-1">
            <p className="text-xs text-[var(--color-text-muted)]">Engagement</p>
            <p>Response rate (30d): {formatPercent(engagement?.responseRate30d ?? 0)}</p>
            <p>Risk: {engagement?.isAtRisk ? 'At risk' : 'Normal'}</p>
            <p>Hired: {user.hiredDate ? formatDate(user.hiredDate) : '-'}</p>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              onOpenChange(false);
              onNavigate('employee-detail', { id: user.id });
            }}
          >
            Open full employee profile
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
