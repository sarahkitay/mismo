import { useEffect, useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { Policy } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { defaultDateRange, inDateRange, type DateRangeState } from '@/lib/dateFilters';
import { formatDate, getMemoCategoryDisplay } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface AdminPoliciesProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function AdminPolicies({ dataStore, onNavigate }: AdminPoliciesProps) {
  const [titleQuery, setTitleQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeState>(defaultDateRange);
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'ALPHA'>('NEWEST');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED' | 'REPLACED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const pageSize = 10;

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 250);
    return () => clearTimeout(timer);
  }, []);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    dataStore.policies.forEach((p) => set.add(getMemoCategoryDisplay(p)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dataStore.policies]);

  const filtered = useMemo(() => {
    const q = titleQuery.trim().toLowerCase();
    return dataStore.policies
      .filter((memo) => {
        const cat = getMemoCategoryDisplay(memo);
        const matchesCategory = categoryFilter === 'ALL' || cat === categoryFilter;
        const haystack = `${memo.title} ${memo.content} ${memo.tags.join(' ')} ${cat}`.toLowerCase();
        const matchesTitle = !q || haystack.includes(q);
        const publishInRange = inDateRange(memo.effectiveDate, dateRange);
        const dueInRange = memo.completionDueDate ? inDateRange(memo.completionDueDate, dateRange) : false;
        const matchesDate = publishInRange || dueInRange;
        const matchesStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'ACTIVE' && memo.status === 'PUBLISHED') ||
          (statusFilter === 'ARCHIVED' && memo.status === 'ARCHIVED') ||
          (statusFilter === 'REPLACED' && !!memo.supersededBy);
        return matchesCategory && matchesTitle && matchesDate && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'ALPHA') return a.title.localeCompare(b.title);
        if (sortBy === 'OLDEST') return a.createdAt.getTime() - b.createdAt.getTime();
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }, [dataStore.policies, dateRange, titleQuery, sortBy, statusFilter, categoryFilter]);

  const activeMemos = filtered.filter((m) => m.status !== 'ARCHIVED');
  const archivedMemos = filtered.filter((m) => m.status === 'ARCHIVED');
  const pagedActive = activeMemos.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(activeMemos.length / pageSize));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Company memos</h1>
          <p className="text-[var(--mismo-text-secondary)]">
            Create, publish, and version memos. Search by category, title, or date range (publish or completion due date).
          </p>
        </div>
        <Button className="bg-[var(--mismo-blue)] hover:bg-blue-600 shrink-0" onClick={() => onNavigate('policy-detail', { id: 'new' })}>
          Add memo
        </Button>
      </div>

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="memo-title-search">Title or keywords</Label>
              <Input
                id="memo-title-search"
                placeholder="Search memo title or body…"
                value={titleQuery}
                onChange={(e) => setTitleQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Memo category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All categories</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          <p className="text-xs text-[var(--mismo-text-secondary)]">
            Date range matches <strong>publish date</strong> or <strong>end / completion due date</strong>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={sortBy === 'NEWEST' ? 'default' : 'outline'} onClick={() => setSortBy('NEWEST')}>
              Newest first
            </Button>
            <Button type="button" size="sm" variant={sortBy === 'OLDEST' ? 'default' : 'outline'} onClick={() => setSortBy('OLDEST')}>
              Oldest first
            </Button>
            <Button type="button" size="sm" variant={sortBy === 'ALPHA' ? 'default' : 'outline'} onClick={() => setSortBy('ALPHA')}>
              Alphabetical
            </Button>
            <Button type="button" size="sm" variant={statusFilter === 'ALL' ? 'default' : 'outline'} onClick={() => setStatusFilter('ALL')}>
              All statuses
            </Button>
            <Button type="button" size="sm" variant={statusFilter === 'ACTIVE' ? 'default' : 'outline'} onClick={() => setStatusFilter('ACTIVE')}>
              Published
            </Button>
            <Button type="button" size="sm" variant={statusFilter === 'ARCHIVED' ? 'default' : 'outline'} onClick={() => setStatusFilter('ARCHIVED')}>
              Archived
            </Button>
            <Button type="button" size="sm" variant={statusFilter === 'REPLACED' ? 'default' : 'outline'} onClick={() => setStatusFilter('REPLACED')}>
              Superseded
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setTitleQuery('');
                setDateRange(defaultDateRange);
                setStatusFilter('ALL');
                setCategoryFilter('ALL');
              }}
            >
              Clear filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-[var(--mismo-text-secondary)]">Loading memos…</p>
          ) : (
            pagedActive.map((memo, idx) => (
              <MemoRow key={memo.id} memo={memo} idx={(page - 1) * pageSize + idx + 1} onNavigate={onNavigate} />
            ))
          )}
          {!isLoading && activeMemos.length === 0 && (
            <p className="p-6 text-sm text-[var(--mismo-text-secondary)]">No memos match your filters.</p>
          )}
          <div className="px-4 py-3 flex items-center justify-between border-t border-[var(--color-border-200)]">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </Button>
            <span className="text-sm text-[var(--mismo-text-secondary)]">
              Page {page} of {totalPages}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Next
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-0">
          <button
            type="button"
            className="interactive-control w-full px-4 py-3 text-left border-b font-medium text-[var(--mismo-text)]"
            onClick={() => setShowArchived((open) => !open)}
          >
            Archived memos ({archivedMemos.length}) {showArchived ? '▲' : '▼'}
          </button>
          {showArchived &&
            archivedMemos.map((memo) => (
              <MemoRow key={memo.id} memo={memo} idx={0} onNavigate={onNavigate} showIndex={false} />
            ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MemoRow({
  memo,
  idx,
  onNavigate,
  showIndex = true,
}: {
  memo: Policy;
  idx: number;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  showIndex?: boolean;
}) {
  const cat = getMemoCategoryDisplay(memo);
  return (
    <button
      type="button"
      className="interactive-control w-full flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-200)] text-left hover:bg-[var(--color-surface-200)]"
      onClick={() => onNavigate('policy-detail', { id: memo.id })}
    >
      <div className="min-w-0 pr-2">
        <p className="font-medium text-[var(--mismo-text)] truncate">
          {showIndex ? `#${idx} ` : ''}
          {memo.title}
        </p>
        <p className="text-sm text-[var(--mismo-text-secondary)]">
          {cat} · Publish {formatDate(memo.effectiveDate)}
          {memo.completionDueDate && ` · Due ${formatDate(memo.completionDueDate)}`}
        </p>
      </div>
      <span className="text-xs border border-[var(--color-border-200)] px-2 py-1 shrink-0 rounded">{memo.status}</span>
    </button>
  );
}
