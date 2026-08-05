import type { AppNotification } from '@/types';
import type { DataStore } from '@/hooks/useDataStore';
import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icons } from '@/lib/icons';
import { formatRelativeTime } from '@/lib/utils';

interface DashboardNotificationsProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  /** Limit list length on the dashboard. */
  limit?: number;
}

function kindLabel(kind: AppNotification['kind']): string {
  switch (kind) {
    case 'INVITE':
      return 'Invite';
    case 'PASSWORD_RESET':
      return 'Password';
    case 'PASSWORD_CHANGED':
      return 'Password';
    case 'MESSAGE':
      return 'Message';
    case 'MEMO':
      return 'Memo';
    case 'PROMPT':
      return 'Prompt';
    case 'CASE_UPDATE':
      return 'Case';
    default:
      return 'Update';
  }
}

export function DashboardNotifications({
  dataStore,
  onNavigate,
  limit = 8,
}: DashboardNotificationsProps) {
  const { appNotifications, currentUser, markNotificationRead, markAllNotificationsRead, refreshAppNotifications } =
    dataStore;

  useEffect(() => {
    void refreshAppNotifications?.();
  }, [refreshAppNotifications]);

  const mine = appNotifications
    .filter((n) => n.userId === currentUser.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const unread = mine.filter((n) => !n.readAt);
  const visible = mine.slice(0, limit);

  const openNotification = (n: AppNotification) => {
    if (!n.readAt) markNotificationRead(n.id);
    if (n.actionPage) {
      onNavigate(n.actionPage === 'dashboard' ? 'dashboard' : n.actionPage, n.actionParams);
    }
  };

  return (
    <Card className="mismo-card">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)] flex items-center gap-2">
              <Icons.bell className="h-3.5 w-3.5" />
              Notifications
              {unread.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-[var(--color-alert-600)] text-white text-[11px] font-semibold tabular-nums">
                  {unread.length}
                </span>
              )}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">
              Invites, password resets, messages, and case updates — including emails sent via Resend.
            </p>
          </div>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" className="shrink-0 text-xs" onClick={() => markAllNotificationsRead()}>
              Mark all read
            </Button>
          )}
        </div>

        {visible.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">No notifications yet.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {visible.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => openNotification(n)}
                  className={`w-full text-left rounded border px-3 py-2.5 transition-colors ${
                    n.readAt
                      ? 'border-[var(--color-border-200)] hover:bg-[var(--color-surface-200)]'
                      : 'border-[var(--color-primary-700)]/30 bg-[var(--color-primary-900)]/[0.04] hover:bg-[var(--color-primary-900)]/[0.07]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                        {kindLabel(n.kind)}
                        {n.emailStatus?.startsWith('sent') ? ' · emailed' : ''}
                      </p>
                      <p className={`text-sm mt-0.5 ${n.readAt ? 'font-normal' : 'font-medium'} text-[var(--mismo-text)]`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-[var(--color-text-secondary)] mt-1 line-clamp-2">{n.body}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--color-text-muted)] shrink-0 whitespace-nowrap">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
