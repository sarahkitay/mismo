import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { notificationClearedByPage, notificationKindLabel } from '@/lib/notificationRouting';
import { toast } from 'sonner';

interface TopNavNotificationsProps {
  dataStore: DataStore;
  onNavigate?: (page: string, params?: Record<string, string>) => void;
  /** Current app page — used to auto-clear related unread notifications. */
  activePage?: string;
}

export function TopNavNotifications({ dataStore, onNavigate, activePage }: TopNavNotificationsProps) {
  const { appNotifications, currentUser, markNotificationRead, markAllNotificationsRead, refreshAppNotifications } =
    dataStore;
  const [showAll, setShowAll] = useState(false);
  const toastedIdsRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);

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
  const unread = useMemo(() => mine.filter((n) => !n.readAt), [mine]);
  const visible = showAll ? mine.slice(0, 20) : unread.slice(0, 12);

  const openNotification = useCallback(
    (n: AppNotification) => {
      if (!n.readAt) markNotificationRead(n.id);
      if (!n.actionPage || !onNavigate) return;

      if (n.actionPage.startsWith('employee/case-note-review/')) {
        onNavigate(n.actionPage.slice('employee/'.length));
        return;
      }
      if (n.actionPage.startsWith('employee/investigation-response/')) {
        onNavigate(n.actionPage.slice('employee/'.length));
        return;
      }
      if (n.actionPage.startsWith('case-note-review/')) {
        onNavigate(n.actionPage);
        return;
      }
      if (n.actionPage.startsWith('investigation-response/')) {
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
      if (n.actionPage === 'case-register') {
        onNavigate('prompt-responses', {
          view: 'register',
          register: '1',
          channel: n.actionParams?.channel ?? 'register',
          ...(n.actionParams ?? {}),
        });
        return;
      }
      onNavigate(n.actionPage, n.actionParams);
    },
    [markNotificationRead, onNavigate]
  );

  // Toast new unread notifications briefly (skip first hydrate so the screen isn't flooded).
  useEffect(() => {
    if (!hydratedRef.current) {
      unread.forEach((n) => toastedIdsRef.current.add(n.id));
      hydratedRef.current = true;
      return;
    }
    for (const n of unread) {
      if (toastedIdsRef.current.has(n.id)) continue;
      toastedIdsRef.current.add(n.id);
      toast(n.title, {
        description: n.body?.slice(0, 120) || notificationKindLabel(n),
        duration: 4500,
        action: n.actionPage
          ? {
              label: 'Open',
              onClick: () => openNotification(n),
            }
          : undefined,
      });
    }
  }, [unread, openNotification]);

  // Visiting a related page clears matching unread notifications.
  useEffect(() => {
    if (!activePage) return;
    for (const n of unread) {
      if (notificationClearedByPage(n, activePage)) {
        markNotificationRead(n.id);
      }
    }
  }, [activePage, unread, markNotificationRead]);

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) setShowAll(false);
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-md transition-colors"
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
          <span>{showAll ? 'All notifications' : 'Unread'}</span>
          {unread.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={(e) => {
                e.preventDefault();
                markAllNotificationsRead();
              }}
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {visible.length === 0 ? (
          <div className="px-3 py-4 text-sm text-[var(--color-text-secondary)]">
            {showAll ? 'No notifications yet.' : 'You are all caught up.'}
          </div>
        ) : (
          visible.map((n) => (
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-xs text-[var(--mismo-blue)] cursor-pointer"
          onSelect={(e) => {
            e.preventDefault();
            setShowAll((v) => !v);
          }}
        >
          {showAll ? 'Show unread only' : 'View all notifications'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
