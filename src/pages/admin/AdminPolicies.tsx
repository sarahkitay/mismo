import { useEffect, useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { Policy } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { defaultDateRange, inDateRange, type DateRangeState } from '@/lib/dateFilters';
import { formatDate, getMemoCategoryDisplay } from '@/lib/utils';
import { downloadCsv } from '@/lib/exportCsv';
import { ReportBuilderDialog } from '@/components/admin/ReportBuilderDialog';
import { toast } from 'sonner';
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
  initialFilters?: Record<string, string>;
}

export function AdminPolicies({ dataStore, onNavigate, initialFilters }: AdminPoliciesProps) {
  const [titleQuery, setTitleQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeState>(defaultDateRange);
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'ALPHA'>('NEWEST');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED' | 'REPLACED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState(false);
  const [memoQueueFilter, setMemoQueueFilter] = useState<'ALL' | 'PENDING_ACK' | 'CLARIFICATION'>('ALL');
  const [reportOpen, setReportOpen] = useState(false);

  const filterKey = JSON.stringify(initialFilters ?? {});
  useEffect(() => {
    const q = initialFilters?.memoQueue;
    if (q === 'pending_ack') setMemoQueueFilter('PENDING_ACK');
    else if (q === 'clarification') setMemoQueueFilter('CLARIFICATION');
    else setMemoQueueFilter('ALL');
  }, [filterKey]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
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
    const employees = dataStore.users.filter((u) => u.role === 'EMPLOYEE' && u.status === 'active');
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
        if (memoQueueFilter === 'PENDING_ACK') {
          if (memo.status !== 'PUBLISHED' || !memo.acknowledgmentRequired) return false;
          const anyMissing = employees.some(
            (emp) => !dataStore.policyAcknowledgements.some((a) => a.policyId === memo.id && a.userId === emp.id)
          );
          if (!anyMissing) return false;
        }
        if (memoQueueFilter === 'CLARIFICATION') {
          const hasClar = dataStore.policyAcknowledgements.some(
            (a) => a.policyId === memo.id && a.outcome === 'REQUEST_CLARIFICATION'
          );
          if (!hasClar) return false;
        }
        return matchesCategory && matchesTitle && matchesDate && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'ALPHA') return a.title.localeCompare(b.title);
        if (sortBy === 'OLDEST') return a.createdAt.getTime() - b.createdAt.getTime();
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }, [dataStore.policies, dataStore.users, dataStore.policyAcknowledgements, dateRange, titleQuery, sortBy, statusFilter, categoryFilter, memoQueueFilter]);

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
          {memoQueueFilter !== 'ALL' && (
            <p className="mt-2 text-sm text-[var(--color-primary-900)] border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-3 py-2">
              URL filter: {memoQueueFilter === 'PENDING_ACK' ? 'Memos with missing acknowledgements' : 'Memos with clarification requests'}.
              <button type="button" className="ml-2 text-[var(--mismo-blue)] underline" onClick={() => onNavigate('policies', {})}>
                Clear
              </button>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" onClick={() => setReportOpen(true)}>
            Run memo report
          </Button>
          <Button className="bg-[var(--mismo-blue)] hover:bg-blue-600" onClick={() => onNavigate('policy-detail', { id: 'new' })}>
            Add memo
          </Button>
        </div>
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
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <p className="p-6 text-sm text-[var(--mismo-text-secondary)]">Loading memos…</p>
          ) : activeMemos.length === 0 ? (
            <p className="p-6 text-sm text-[var(--mismo-text-secondary)]">
              No memos match your filters. Published memos will appear here with acknowledgement counts and status.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Publish</th>
                  <th className="px-3 py-2 text-left">Due</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Ack req.</th>
                  <th className="px-3 py-2 text-left">Understood</th>
                  <th className="px-3 py-2 text-left">Clarification</th>
                  <th className="px-3 py-2 text-left">Unanswered</th>
                  <th className="px-3 py-2 text-left">Updated</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedActive.map((memo) => (
                  <MemoTableRow key={memo.id} memo={memo} dataStore={dataStore} onNavigate={onNavigate} />
                ))}
              </tbody>
            </table>
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
          {showArchived && archivedMemos.length > 0 && (
            <table className="w-full text-sm">
              <tbody>
                {archivedMemos.map((memo) => (
                  <MemoTableRow key={memo.id} memo={memo} dataStore={dataStore} onNavigate={onNavigate} archived />
                ))}
              </tbody>
            </table>
          )}
          {showArchived && archivedMemos.length === 0 && (
            <p className="p-4 text-sm text-[var(--mismo-text-secondary)]">No archived memos match filters.</p>
          )}
        </CardContent>
      </Card>

      <ReportBuilderDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        kind="memo_ack"
        title="Memo acknowledgement report"
        preset={{ category: categoryFilter !== 'ALL' ? categoryFilter : '' }}
        onExport={(_, format) => {
          const employees = dataStore.users.filter((u) => u.role === 'EMPLOYEE' && u.status === 'active');
          const headers = ['Memo', 'Category', 'Employee', 'Status', 'Acknowledged'];
          const rows: (string | number)[][] = [];
          filtered.forEach((memo) => {
            employees.forEach((emp) => {
              const ack = dataStore.policyAcknowledgements.find((a) => a.policyId === memo.id && a.userId === emp.id);
              rows.push([
                memo.title,
                getMemoCategoryDisplay(memo),
                `${emp.firstName} ${emp.lastName}`,
                ack?.outcome ?? 'Unanswered',
                ack ? formatDate(ack.acknowledgedAt) : '-',
              ]);
            });
          });
          downloadCsv(`mismo-memo-report-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
          toast.success(`${format} memo acknowledgement report exported.`);
        }}
      />
    </div>
  );
}

function MemoTableRow({
  memo,
  dataStore,
  onNavigate,
  archived = false,
}: {
  memo: Policy;
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  archived?: boolean;
}) {
  const cat = getMemoCategoryDisplay(memo);
  const employees = dataStore.users.filter((u) => u.role === 'EMPLOYEE' && u.status === 'active');
  const acks = dataStore.policyAcknowledgements.filter((a) => a.policyId === memo.id);
  const understood = acks.filter((a) => a.outcome === 'READ_UNDERSTOOD').length;
  const clarification = acks.filter((a) => a.outcome === 'REQUEST_CLARIFICATION').length;
  const unanswered = memo.acknowledgmentRequired
    ? employees.filter((e) => !acks.some((a) => a.userId === e.id)).length
    : 0;

  return (
    <tr
      className={`border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)] cursor-pointer ${archived ? 'opacity-80' : ''}`}
      onClick={() => onNavigate('policy-detail', { id: memo.id })}
    >
      <td className="px-3 py-2 font-medium max-w-[200px] truncate">{memo.title}</td>
      <td className="px-3 py-2 text-xs">{cat}</td>
      <td className="px-3 py-2 whitespace-nowrap">{formatDate(memo.effectiveDate)}</td>
      <td className="px-3 py-2 whitespace-nowrap">{memo.completionDueDate ? formatDate(memo.completionDueDate) : '-'}</td>
      <td className="px-3 py-2">{memo.status}</td>
      <td className="px-3 py-2">{memo.acknowledgmentRequired ? 'Yes' : 'No'}</td>
      <td className="px-3 py-2">{understood}</td>
      <td className="px-3 py-2">{clarification}</td>
      <td className="px-3 py-2">{unanswered}</td>
      <td className="px-3 py-2 whitespace-nowrap">{formatDate(memo.updatedAt)}</td>
      <td className="px-3 py-2 text-right">
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('policy-detail', { id: memo.id });
          }}
        >
          Open
        </Button>
      </td>
    </tr>
  );
}
