import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { Report, ReportSeverity, ReportStatus } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { defaultDateRange, inDateRange, type DateRangeState } from '@/lib/dateFilters';
import {
  getCategoryLabel,
  truncateText,
  formatRelativeTime,
  formatDate,
  isIncidentIntakeComplete,
  getEffectiveInvestigationPhase,
  investigationWorkflowLabel,
} from '@/lib/utils';
import { Icons } from '@/lib/icons';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPEN_STATUSES: ReportStatus[] = ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_REVIEW', 'NEEDS_INFO'];
const SLA_DAYS = 14;

function isOpenReport(r: Report) {
  return OPEN_STATUSES.includes(r.status);
}

function isOverSla(r: Report) {
  if (['RESOLVED', 'CLOSED'].includes(r.status)) return false;
  const now = Date.now();
  const updated = (r.updatedAt ?? r.createdAt) instanceof Date ? (r.updatedAt ?? r.createdAt).getTime() : new Date(String(r.updatedAt ?? r.createdAt)).getTime();
  return now - updated > SLA_DAYS * 24 * 60 * 60 * 1000;
}

/** Cases under an open investigation are owned on the Investigations page only */
function isUnderOpenInvestigation(report: Report, investigations: { id: string; status: string }[]) {
  if (!report.investigationId) return false;
  const inv = investigations.find((i) => i.id === report.investigationId);
  return inv?.status === 'OPEN';
}

export type CaseRegisterBucket =
  | 'PROMPT_ALL'
  | 'PROMPT_YES'
  | 'PROMPT_NO'
  | 'PROMPT_UNANSWERED'
  | 'CASE_REGISTER'
  | 'NEW_CRITICAL'
  | 'NEEDS_RESPONSE';

function deriveBucket(entry: 'reports' | 'prompt-responses', filters: Record<string, string>): CaseRegisterBucket {
  if (filters.critical === '1') return 'NEW_CRITICAL';
  if (filters.needs_info === '1') return 'NEEDS_RESPONSE';
  if (filters.answer === 'HAS_ISSUE') return 'PROMPT_YES';
  if (filters.answer === 'NO_ISSUE') return 'PROMPT_NO';
  if (filters.bucket === 'UNANSWERED') return 'PROMPT_UNANSWERED';
  if (entry === 'reports') return 'CASE_REGISTER';
  return 'PROMPT_ALL';
}

interface AdminCaseRegisterHubProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
  entry: 'reports' | 'prompt-responses';
}

export function AdminCaseRegisterHub({ dataStore, onNavigate, initialFilters, entry }: AdminCaseRegisterHubProps) {
  const filters = initialFilters ?? {};
  const { reports, users, investigations, deliveries, responses, prompts, assignReport, updateReportStatus, createInvestigation } = dataStore;

  const [bucket, setBucket] = useState<CaseRegisterBucket>(() => deriveBucket(entry, filters));
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setBucket(deriveBucket(entry, filters));
  }, [entry, filterKey]);

  const [query, setQuery] = useState('');
  const [promptQuery, setPromptQuery] = useState('');
  const [range, setRange] = useState<DateRangeState>(() => ({
    ...defaultDateRange,
    preset: (filters.rangePreset as DateRangeState['preset'] | undefined) ?? 'ALL',
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  }));
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<ReportSeverity | 'ALL'>('ALL');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  const initialStatus = filters.status?.split(',').filter(Boolean) ?? [];
  const initialSeverity = filters.severity?.split(',').filter(Boolean) ?? [];
  const tileUnassigned = filters.unassigned === '1';
  const tileCritical = filters.critical === '1';
  const tileNeedsInfo = filters.needs_info === '1';
  const tileNew24h = filters.new24h === '1';
  const tileNew7d = filters.new7d === '1';
  const tileOverSla = filters.over_sla === '1';

  const registerReports = useMemo(
    () => reports.filter((r) => !isUnderOpenInvestigation(r, investigations)),
    [reports, investigations]
  );

  const riskSummary = useMemo(() => {
    const now = Date.now();
    const ms24h = 24 * 60 * 60 * 1000;
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    const base = registerReports;
    return {
      criticalOpen: base.filter((r) => (r.severity === 'CRITICAL' || r.severity === 'HIGH') && isOpenReport(r)).length,
      unassigned: base.filter((r) => !r.assignedTo && isOpenReport(r)).length,
      needsResponse: base.filter((r) => r.status === 'NEEDS_INFO').length,
      new24h: base.filter((r) => {
        const t = (r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt))).getTime();
        return now - t <= ms24h;
      }).length,
      new7d: base.filter((r) => {
        const t = (r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt))).getTime();
        return now - t <= ms7d;
      }).length,
      overSla: base.filter((r) => isOpenReport(r) && isOverSla(r)).length,
    };
  }, [registerReports]);

  const unansweredCount = deliveries.filter((d) => d.status === 'PENDING').length;
  const yesCount = responses.filter((r) => r.answer === 'HAS_ISSUE').length;
  const noCount = responses.filter((r) => r.answer === 'NO_ISSUE').length;

  const promptRows = useMemo(() => {
    if (bucket === 'CASE_REGISTER' || bucket === 'NEW_CRITICAL' || bucket === 'NEEDS_RESPONSE') return [];
    const q = promptQuery.trim().toLowerCase();
    if (bucket === 'PROMPT_UNANSWERED') {
      return deliveries
        .filter((d) => d.status === 'PENDING' && inDateRange(d.deliveredAt, range))
        .map((d) => {
          const u = users.find((user) => user.id === d.userId);
          return {
            id: d.id,
            promptTitle: prompts.find((p) => p.id === d.promptId)?.title ?? 'Prompt',
            userName: u ? `${u.firstName} ${u.lastName}` : 'Employee',
            answer: 'UNANSWERED' as const,
            date: d.deliveredAt,
          };
        })
        .filter((row) => `${row.promptTitle} ${row.userName}`.toLowerCase().includes(q));
    }
    const ansFilter = bucket === 'PROMPT_YES' ? 'HAS_ISSUE' : bucket === 'PROMPT_NO' ? 'NO_ISSUE' : null;
    return responses
      .filter((r) => inDateRange(r.createdAt, range))
      .filter((r) => ansFilter === null || r.answer === ansFilter)
      .map((r) => {
        const u = users.find((user) => user.id === r.userId);
        return {
          id: r.id,
          promptTitle: prompts.find((p) => p.id === r.promptId)?.title ?? 'Prompt',
          userName: u ? `${u.firstName} ${u.lastName}` : 'Employee',
          answer: r.answer,
          date: r.submittedAt,
        };
      })
      .filter((row) => `${row.promptTitle} ${row.userName}`.toLowerCase().includes(q));
  }, [bucket, deliveries, responses, prompts, users, range, promptQuery]);

  const filteredRegisterReports = useMemo(() => {
    const ms24h = 24 * 60 * 60 * 1000;
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    return registerReports
      .filter((report) => {
        if (bucket === 'NEW_CRITICAL') {
          if (!(report.severity === 'CRITICAL' || report.severity === 'HIGH') || !isOpenReport(report)) return false;
        } else if (bucket === 'NEEDS_RESPONSE') {
          if (report.status !== 'NEEDS_INFO') return false;
        }
        const text = `${report.id} ${report.summary} ${report.description} ${report.category}`.toLowerCase();
        const matchesQuery = !query || text.includes(query.toLowerCase());
        const matchesDate = inDateRange(report.updatedAt ?? report.createdAt, range);
        const matchesStatus =
          initialStatus.length > 0 ? initialStatus.includes(report.status) : statusFilter === 'ALL' || report.status === statusFilter;
        const matchesSeverity =
          initialSeverity.length > 0 ? initialSeverity.includes(report.severity) : severityFilter === 'ALL' || report.severity === severityFilter;
        if (tileUnassigned && report.assignedTo) return false;
        if (tileCritical && (report.severity !== 'CRITICAL' || !isOpenReport(report))) return false;
        if (tileNeedsInfo && report.status !== 'NEEDS_INFO') return false;
        if (tileNew24h) {
          const t = (report.createdAt instanceof Date ? report.createdAt : new Date(String(report.createdAt))).getTime();
          if (Date.now() - t > ms24h) return false;
        }
        if (tileNew7d) {
          const t = (report.createdAt instanceof Date ? report.createdAt : new Date(String(report.createdAt))).getTime();
          if (Date.now() - t > ms7d) return false;
        }
        if (tileOverSla && (!isOpenReport(report) || !isOverSla(report))) return false;
        return matchesQuery && matchesDate && matchesStatus && matchesSeverity;
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [
    registerReports,
    bucket,
    query,
    range,
    statusFilter,
    severityFilter,
    initialStatus,
    initialSeverity,
    tileUnassigned,
    tileCritical,
    tileNeedsInfo,
    tileNew24h,
    tileNew7d,
    tileOverSla,
  ]);

  const applyTile = (params: Record<string, string>) => {
    onNavigate('reports', params);
  };
  const clearTile = () => onNavigate('reports', {});

  const showCaseTable =
    bucket === 'CASE_REGISTER' || bucket === 'NEW_CRITICAL' || bucket === 'NEEDS_RESPONSE';
  const showPromptList =
    bucket === 'PROMPT_ALL' || bucket === 'PROMPT_YES' || bucket === 'PROMPT_NO' || bucket === 'PROMPT_UNANSWERED';

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };
  const toggleAll = () => {
    if (selectedRows.length === filteredRegisterReports.length) setSelectedRows([]);
    else setSelectedRows(filteredRegisterReports.map((r) => r.id));
  };

  const bulkAssign = () => {
    selectedRows.forEach((id) => assignReport(id, dataStore.currentUser.id));
    setSelectedRows([]);
    toast.success('Assignments recorded in compliance log.');
  };
  const bulkStatus = (status: ReportStatus) => {
    selectedRows.forEach((id) => updateReportStatus(id, status));
    setSelectedRows([]);
    toast.success(`Status update recorded: ${status}.`);
  };

  return (
    <div className="space-y-5">
      <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-5 py-4">
        <h1 className="mismo-heading text-3xl text-[var(--color-primary-900)]">Case register &amp; check-ins</h1>
        <p className="mt-1 text-[var(--color-text-secondary)]">
          Prompt yes/no/unanswered intake and case files in one place.{' '}
          <strong>Open investigations</strong> stay on the{' '}
          <button type="button" className="text-[var(--mismo-blue)] hover:underline font-medium" onClick={() => onNavigate('investigations')}>
            Investigations
          </button>{' '}
          tab only—those cases are removed from this register until closed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <BucketBtn active={bucket === 'PROMPT_YES'} onClick={() => setBucket('PROMPT_YES')}>
          Yes ({yesCount})
        </BucketBtn>
        <BucketBtn active={bucket === 'PROMPT_NO'} onClick={() => setBucket('PROMPT_NO')}>
          No ({noCount})
        </BucketBtn>
        <BucketBtn active={bucket === 'PROMPT_UNANSWERED'} onClick={() => setBucket('PROMPT_UNANSWERED')}>
          Unanswered ({unansweredCount})
        </BucketBtn>
        <BucketBtn active={bucket === 'PROMPT_ALL'} onClick={() => setBucket('PROMPT_ALL')}>
          All check-ins
        </BucketBtn>
        <BucketBtn active={bucket === 'CASE_REGISTER'} onClick={() => setBucket('CASE_REGISTER')}>
          Case register
        </BucketBtn>
        <BucketBtn active={bucket === 'NEW_CRITICAL'} onClick={() => setBucket('NEW_CRITICAL')}>
          New critical
        </BucketBtn>
        <BucketBtn active={bucket === 'NEEDS_RESPONSE'} onClick={() => setBucket('NEEDS_RESPONSE')}>
          Needs response
        </BucketBtn>
      </div>

      {showCaseTable && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Tile active={tileCritical} onClick={() => applyTile(tileCritical ? {} : { critical: '1' })} label="Critical / high open" value={riskSummary.criticalOpen} />
            <Tile active={tileUnassigned} onClick={() => applyTile(tileUnassigned ? {} : { unassigned: '1' })} label="Unassigned" value={riskSummary.unassigned} />
            <Tile active={tileNeedsInfo} onClick={() => applyTile(tileNeedsInfo ? {} : { needs_info: '1' })} label="Needs response" value={riskSummary.needsResponse} />
            <Tile active={tileNew24h} onClick={() => applyTile(tileNew24h ? {} : { new24h: '1' })} label="New (24h)" value={riskSummary.new24h} />
            <Tile active={tileNew7d} onClick={() => applyTile(tileNew7d ? {} : { new7d: '1' })} label="New (7d)" value={riskSummary.new7d} />
            <Tile active={tileOverSla} onClick={() => applyTile(tileOverSla ? {} : { over_sla: '1' })} label="Over SLA" value={riskSummary.overSla} />
          </div>
          {(tileUnassigned || tileCritical || tileNeedsInfo || tileNew24h || tileNew7d || tileOverSla) && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Tile filter active.{' '}
              <button type="button" onClick={clearTile} className="text-[var(--mismo-blue)] hover:underline">
                Clear tile filter
              </button>
            </p>
          )}
        </>
      )}

      {showPromptList && (
        <div className="space-y-2">
          <Input placeholder="Search check-ins…" value={promptQuery} onChange={(e) => setPromptQuery(e.target.value)} />
          <DateRangeFilter value={range} onChange={setRange} />
        </div>
      )}

      {showCaseTable && (
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3">
              <div className="relative">
                <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  placeholder="Search case ID, summary, description, or category…"
                />
              </div>
              <select
                className="border border-[var(--color-border-200)] px-3 py-2 bg-white text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ReportStatus | 'ALL')}
              >
                <option value="ALL">All statuses</option>
                <option value="NEW">NEW</option>
                <option value="TRIAGED">TRIAGED</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="IN_REVIEW">IN REVIEW</option>
                <option value="NEEDS_INFO">NEEDS INFO</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
              <select
                className="border border-[var(--color-border-200)] px-3 py-2 bg-white text-sm"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as ReportSeverity | 'ALL')}
              >
                <option value="ALL">All severities</option>
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
            <DateRangeFilter value={range} onChange={setRange} />

            {selectedRows.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 bg-[var(--color-surface-200)] border border-[var(--color-border-200)] px-3 py-2">
                <span className="text-sm text-[var(--color-text-secondary)]">{selectedRows.length} selected</span>
                <Button size="sm" variant="outline" onClick={bulkAssign}>
                  Assign to me
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkStatus('TRIAGED')}>
                  Mark triaged
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkStatus('IN_REVIEW')}>
                  Mark in review
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkStatus('NEEDS_INFO')}>
                  Request info
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    selectedRows.forEach((id) => {
                      const r = reports.find((report) => report.id === id);
                      if (r && !r.investigationId && r.status !== 'NEW') createInvestigation(id, dataStore.currentUser.id);
                    });
                    setSelectedRows([]);
                    toast.success('Investigations created for selected reports.');
                  }}
                >
                  Convert to investigation
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSelectedRows([])}>
                  Clear
                </Button>
              </div>
            )}

            <div className="overflow-x-auto border border-[var(--color-border-200)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      <input
                        type="checkbox"
                        checked={filteredRegisterReports.length > 0 && selectedRows.length === filteredRegisterReports.length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-3 py-2 text-left">Case</th>
                    <th className="px-3 py-2 text-left">Reported</th>
                    <th className="px-3 py-2 text-left">Employee</th>
                    <th className="px-3 py-2 text-left">Incident form</th>
                    <th className="px-3 py-2 text-left">Investigation</th>
                    <th className="px-3 py-2 text-left">Category</th>
                    <th className="px-3 py-2 text-left">Severity</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Assigned</th>
                    <th className="px-3 py-2 text-left">Last updated</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegisterReports.map((report) => {
                    const assignee = report.assignedTo ? users.find((user) => user.id === report.assignedTo) : null;
                    const reporter = report.createdByUserId ? users.find((u) => u.id === report.createdByUserId) : null;
                    const inv = report.investigationId ? investigations.find((i) => i.id === report.investigationId) : undefined;
                    return (
                      <tr key={report.id} className="border-t border-[var(--color-border-200)]">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedRows.includes(report.id)} onChange={() => toggleRow(report.id)} />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="interactive-control text-left"
                            onClick={() => onNavigate('report-detail', { id: report.id })}
                          >
                            <p className="font-medium text-[var(--color-text-primary)]">#{report.id.replace('report-', '').toUpperCase()}</p>
                            <p className="text-[var(--color-text-secondary)]">{truncateText(report.summary, 52)}</p>
                          </button>
                        </td>
                        <td className="px-3 py-2 text-[var(--color-text-secondary)] whitespace-nowrap">{formatDate(report.createdAt)}</td>
                        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                          {report.isAnonymous ? 'Anonymous' : reporter ? `${reporter.firstName} ${reporter.lastName}` : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={isIncidentIntakeComplete(report) ? 'text-emerald-700' : 'text-amber-700'}>
                            {isIncidentIntakeComplete(report) ? 'Complete' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                          {inv ? (
                            <button
                              type="button"
                              className="text-left text-[var(--mismo-blue)] hover:underline"
                              onClick={() => onNavigate('investigation-detail', { id: inv.id })}
                            >
                              {investigationWorkflowLabel(getEffectiveInvestigationPhase(inv))}
                            </button>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2">{getCategoryLabel(report.category)}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-1 text-xs border border-[var(--color-border-200)] text-[var(--color-text-secondary)]">{report.severity}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-1 text-xs border border-[var(--color-border-200)] text-[var(--color-text-secondary)]">{report.status}</span>
                        </td>
                        <td className="px-3 py-2">{assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned'}</td>
                        <td className="px-3 py-2 text-[var(--color-text-secondary)]">{formatRelativeTime(report.updatedAt)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button variant="default" size="sm" className="bg-[var(--mismo-blue)] hover:bg-[var(--color-primary-700)]" onClick={() => onNavigate('report-detail', { id: report.id })}>
                              Open
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" aria-label="More actions">
                                  <Icons.more className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {!report.assignedTo && (
                                  <DropdownMenuItem onClick={() => { assignReport(report.id, dataStore.currentUser.id); toast.success('Assigned to you.'); }}>
                                    Assign
                                  </DropdownMenuItem>
                                )}
                                {report.status === 'NEW' && (
                                  <DropdownMenuItem onClick={() => { updateReportStatus(report.id, 'TRIAGED'); toast.success('Marked triaged.'); }}>
                                    Mark triaged
                                  </DropdownMenuItem>
                                )}
                                {!report.investigationId && report.status !== 'NEW' && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      const invNew = createInvestigation(report.id, dataStore.currentUser.id);
                                      if (invNew) {
                                        toast.success('Investigation created and linked.');
                                        onNavigate('investigation-detail', { id: invNew.id });
                                      }
                                    }}
                                  >
                                    Convert to investigation
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => { updateReportStatus(report.id, 'NEEDS_INFO'); toast.success('Status set to Needs info.'); }}>
                                  Request info
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onNavigate('report-detail', { id: report.id })}>Export evidence</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredRegisterReports.length === 0 && (
              <p className="text-sm text-[var(--mismo-text-secondary)]">No case records match the current filters.</p>
            )}
          </CardContent>
        </Card>
      )}

      {showPromptList && (
        <Card className="mismo-card border border-[var(--color-border-200)]">
          <CardContent className="p-0">
            {promptRows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="interactive-control w-full border-b border-[var(--color-border-200)] px-4 py-3 text-left hover:bg-[var(--color-surface-200)]"
                onClick={() => onNavigate('prompt-response-detail', { id: row.id, type: row.answer })}
              >
                <p className="font-medium text-[var(--mismo-text)]">{row.promptTitle}</p>
                <p className="text-sm text-[var(--mismo-text-secondary)]">
                  {row.userName} · {row.answer} · {formatDate(row.date)}
                </p>
              </button>
            ))}
            {promptRows.length === 0 && <p className="p-6 text-sm text-[var(--mismo-text-secondary)]">No check-ins match the current filters.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BucketBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`interactive-control px-3 py-2 border text-sm rounded-md ${active ? 'bg-[var(--mismo-blue)] text-white border-[var(--mismo-blue)]' : 'border-[var(--color-border-200)] bg-white'}`}
    >
      {children}
    </button>
  );
}

function Tile({ active, onClick, label, value }: { active: boolean; onClick: () => void; label: string; value: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3 border text-left rounded-lg transition-colors ${
        active ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]' : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)]'
      }`}
    >
      <p className="text-xs text-[var(--color-text-muted)] uppercase">{label}</p>
      <p className="text-xl font-semibold text-[var(--color-text-primary)]">{value}</p>
    </button>
  );
}
