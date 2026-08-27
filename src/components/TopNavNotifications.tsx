import { useEffect, useMemo } from 'react';
import type { AppNotification } from '@/types';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatRelativeTime } from '@/lib/utils';

function notificationKindLabel(n: AppNotification): string {
  if (n.title.toLowerCase().includes('note received')) return 'Note received';
  switch (n.kind) {
    case 'INVITE':
      return 'Invite';
    case 'PASSWORD_RESET':
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

interface TopNavNotificationsProps {
  dataStore: DataStore;
  onNavigate?: (page: string, params?: Record<string, string>) => void;
}

export function TopNavNotifications({ dataStore, onNavigate }: TopNavNotificationsProps) {
  const { appNotifications, currentUser, markNotificationRead, markAllNotificationsRead, refreshAppNotifications } =
    dataStore;

  useEffect(() => {
    void refreshAppNotifications?.();
  }, [refreshAppNotifications]);

  const mine = useMemo(
    () =>
      appNotifications
        .filter((n) => n.userId === currentUser.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    [appNotifications, currentUser.id]
  );
  const unread = mine.filter((n) => !n.readAt);
  const preview = mine.slice(0, 6);

  const openNotification = (n: AppNotification) => {
    if (!n.readAt) markNotificationRead(n.id);
    if (!n.actionPage || !onNavigate) return;

    if (n.actionPage?.startsWith('employee/case-note-review/')) {
      onNavigate(n.actionPage.slice('employee/'.length));
      return;
    }
    if (n.actionPage?.startsWith('employee/investigation-response/')) {
      onNavigate(n.actionPage.slice('employee/'.length));
      return;
    }
    if (n.actionPage?.startsWith('case-note-review/')) {
      onNavigate(n.actionPage);
      return;
    }
    if (n.actionPage?.startsWith('investigation-response/')) {
      onNavigate(n.actionPage);
      return;
    }
    if (n.actionParams?.id && n.actionPage === 'report-detail') {
      onNavigate('report-detail', { id: n.actionParams.id });
      return;
    }
    if (n.actionParams?.id && n.actionPage === 'investigation-detail') {
      onNavigate('investigation-detail', n.actionParams);
      return;
    }
    onNavigate(n.actionPage, n.actionParams);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
          aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`}
        >
          <Icons.bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-[var(--color-alert-600)] text-[10px] font-semibold leading-none flex items-center justify-center">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          {unread.length > 0 && (
            <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs" onClick={() => markAllNotificationsRead()}>
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {preview.length === 0 ? (
          <div className="px-3 py-4 text-sm text-[var(--color-text-secondary)]">No notifications yet.</div>
        ) : (
          preview.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex flex-col items-start gap-1 py-2 cursor-pointer"
              onClick={() => openNotification(n)}
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  {notificationKindLabel(n)}
                </span>
                {!n.readAt && <span className="h-2 w-2 rounded-full bg-[var(--color-alert-600)] shrink-0 mt-1" />}
              </div>
              <span className="text-sm font-medium leading-snug">{n.title}</span>
              <span className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{n.body}</span>
              <span className="text-[11px] text-[var(--color-text-muted)]">{formatRelativeTime(n.createdAt)}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
