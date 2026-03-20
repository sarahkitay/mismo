import { useEffect, useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { defaultDateRange, inDateRange, type DateRangeState } from '@/lib/dateFilters';
import { formatDate } from '@/lib/utils';

interface AdminPoliciesProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function AdminPolicies({ dataStore, onNavigate }: AdminPoliciesProps) {
  const [query, setQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeState>(defaultDateRange);
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'ALPHA'>('NEWEST');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED' | 'REPLACED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GENERAL' | 'SAFETY' | 'CONDUCT' | 'LEGAL'>('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 250);
    return () => clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const searched = dataStore.policies.filter((policy) => {
      const haystack = `${policy.title} ${policy.content} ${policy.tags.join(' ')}`.toLowerCase();
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && policy.status === 'PUBLISHED') ||
        (statusFilter === 'ARCHIVED' && policy.status === 'ARCHIVED') ||
        (statusFilter === 'REPLACED' && !!policy.supersededBy);
      const matchesType = typeFilter === 'ALL' || policy.type === typeFilter;
      return haystack.includes(query.toLowerCase()) && inDateRange(policy.effectiveDate, dateRange) && matchesStatus && matchesType;
    });
    return searched.sort((a, b) => {
      if (sortBy === 'ALPHA') return a.title.localeCompare(b.title);
      if (sortBy === 'OLDEST') return a.createdAt.getTime() - b.createdAt.getTime();
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }, [dataStore.policies, dateRange, query, sortBy, statusFilter, typeFilter]);
  const activePolicies = filtered.filter((policy) => policy.status !== 'ARCHIVED');
  const archivedPolicies = filtered.filter((policy) => policy.status === 'ARCHIVED');
  const pagedActive = activePolicies.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(activePolicies.length / pageSize));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Policies</h1>
          <p className="text-[var(--mismo-text-secondary)]">Search, sort, and manage policy versions.</p>
        </div>
        <Button onClick={() => onNavigate('policy-detail', { id: 'new' })}>Create Policy</Button>
      </div>
      <div className="flex flex-col gap-3">
        <Input placeholder="Search policies..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
        <div className="flex gap-2">
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setSortBy('NEWEST')}>Newest first</button>
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setSortBy('OLDEST')}>Oldest first</button>
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setSortBy('ALPHA')}>Alphabetical</button>
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setStatusFilter('ALL')}>All Statuses</button>
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setStatusFilter('ACTIVE')}>Active</button>
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setStatusFilter('ARCHIVED')}>Archived</button>
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setStatusFilter('REPLACED')}>Replaced</button>
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setTypeFilter('ALL')}>All Types</button>
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setTypeFilter('GENERAL')}>General</button>
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setTypeFilter('SAFETY')}>Safety</button>
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setTypeFilter('CONDUCT')}>Conduct</button>
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setTypeFilter('LEGAL')}>Legal</button>
          <button className="interactive-control px-3 py-2 border text-sm" onClick={() => { setQuery(''); setDateRange(defaultDateRange); setStatusFilter('ALL'); setTypeFilter('ALL'); }}>
            Clear Filters
          </button>
        </div>
      </div>
      <Card className="mismo-card">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-[var(--mismo-text-secondary)]">Loading policies...</p>
          ) : pagedActive.map((policy, idx) => (
            <button
              key={policy.id}
              className="interactive-control w-full flex items-center justify-between px-4 py-3 border-b text-left"
              onClick={() => onNavigate('policy-detail', { id: policy.id })}
            >
              <div>
                <p className="font-medium">#{(page - 1) * pageSize + idx + 1} {policy.title}</p>
                <p className="text-sm text-[var(--mismo-text-secondary)]">{policy.type} · Effective {formatDate(policy.effectiveDate)}</p>
              </div>
              <span className="text-xs border px-2 py-1">{policy.status}</span>
            </button>
          ))}
          {!isLoading && activePolicies.length === 0 && <p className="p-6 text-sm text-[var(--mismo-text-secondary)]">No policies found.</p>}
          <div className="px-4 py-3 flex items-center justify-between">
            <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
            <span className="text-sm text-[var(--mismo-text-secondary)]">Page {page} of {totalPages}</span>
            <button className="interactive-control px-3 py-2 border text-sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
          </div>
        </CardContent>
      </Card>
      <Card className="mismo-card">
        <CardContent className="p-0">
          <button className="interactive-control w-full px-4 py-3 text-left border-b font-medium" onClick={() => setShowArchived((open) => !open)}>
            Archived Policies ({archivedPolicies.length}) {showArchived ? '▲' : '▼'}
          </button>
          {showArchived && archivedPolicies.map((policy) => (
            <button
              key={policy.id}
              className="interactive-control w-full flex items-center justify-between px-4 py-3 border-b text-left"
              onClick={() => onNavigate('policy-detail', { id: policy.id })}
            >
              <div>
                <p className="font-medium">{policy.title}</p>
                <p className="text-sm text-[var(--mismo-text-secondary)]">{policy.type} · Effective {formatDate(policy.effectiveDate)}</p>
              </div>
              <span className="text-xs border px-2 py-1">{policy.status}</span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
