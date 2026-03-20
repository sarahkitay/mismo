import { useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { AdminPolicies } from '@/pages/admin/AdminPolicies';
import { AdminAnnouncements } from '@/pages/admin/AdminAnnouncements';
import { cn } from '@/lib/utils';

interface AdminPoliciesAndAnnouncementsProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialTab?: 'policies' | 'announcements';
}

export function AdminPoliciesAndAnnouncements({
  dataStore,
  onNavigate,
  initialTab = 'policies',
}: AdminPoliciesAndAnnouncementsProps) {
  const [tab, setTab] = useState<'policies' | 'announcements'>(initialTab);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-[var(--color-border-200)] pb-2">
        <button
          type="button"
          onClick={() => setTab('policies')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-t',
            tab === 'policies'
              ? 'bg-[var(--mismo-blue)] text-white'
              : 'bg-transparent text-[var(--mismo-text-secondary)] hover:bg-black/5'
          )}
        >
          Policies
        </button>
        <button
          type="button"
          onClick={() => setTab('announcements')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-t',
            tab === 'announcements'
              ? 'bg-[var(--mismo-blue)] text-white'
              : 'bg-transparent text-[var(--mismo-text-secondary)] hover:bg-black/5'
          )}
        >
          Announcements
        </button>
      </div>
      {tab === 'policies' && <AdminPolicies dataStore={dataStore} onNavigate={onNavigate} />}
      {tab === 'announcements' && <AdminAnnouncements dataStore={dataStore} onNavigate={onNavigate} />}
    </div>
  );
}
