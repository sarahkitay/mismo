import { Button } from '@/components/ui/button';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { getInvestigationDisplayId } from '@/lib/investigationWorkflow';
import type { Investigation, User } from '@/types';

export function EmployeeInvestigationTable({
  rows,
  emptyMessage,
  users,
  onNavigate,
}: {
  rows: Investigation[];
  emptyMessage: string;
  users: User[];
  onNavigate: (page: string, params?: Record<string, string>) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--color-text-secondary)]">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto border border-[var(--color-border-200)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]">
          <tr>
            <th className="px-3 py-2 text-left">Investigation</th>
            <th className="px-3 py-2 text-left">Initiated</th>
            <th className="px-3 py-2 text-left">Modified</th>
            <th className="px-3 py-2 text-left">Investigator</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Stage</th>
            <th className="px-3 py-2 text-left">Docs</th>
            <th className="px-3 py-2 text-left">Notes</th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => {
            const investigator = users.find((u) => u.id === inv.ownerId);
            const noteCount = inv.notes?.length ?? 0;
            const docCount =
              (inv.notes ?? []).reduce((sum, n) => sum + (n.attachments?.length ?? 0), 0) +
              (inv.outcomeAttachment ? 1 : 0);
            return (
              <tr
                key={inv.id}
                className="border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)] cursor-pointer"
                onClick={() => onNavigate('investigation-detail', { id: inv.id, tab: 'page-1' })}
              >
                <td className="px-3 py-2 font-medium text-[var(--mismo-blue)]">
                  {getInvestigationDisplayId(inv)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(inv.openedAt)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatRelativeTime(inv.updatedAt)}</td>
                <td className="px-3 py-2">
                  {investigator ? `${investigator.firstName} ${investigator.lastName}` : 'Unassigned'}
                </td>
                <td className="px-3 py-2">{inv.status}</td>
                <td className="px-3 py-2 text-xs">{inv.workflowPhase ?? 'QUEUED'}</td>
                <td className="px-3 py-2">{docCount}</td>
                <td className="px-3 py-2">{noteCount}</td>
                <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate('investigation-detail', { id: inv.id, tab: 'page-1' })}
                  >
                    View
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
