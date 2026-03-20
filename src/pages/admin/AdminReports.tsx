import { useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { Report, ReportStatus, ReportSeverity } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { defaultDateRange, inDateRange, type DateRangeState } from '@/lib/dateFilters';
import { getCategoryLabel, truncateText, formatRelativeTime } from '@/lib/utils';
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

interface AdminReportsProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
}

export function AdminReports({ dataStore, onNavigate, initialFilters }: AdminReportsProps) {
  const { reports, users, assignReport, updateReportStatus, createInvestigation } = dataStore;
  const [query, setQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeState>(defaultDateRange);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<ReportSeverity | 'ALL'>('ALL');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  const initialStatus = initialFilters?.status?.split(',').filter(Boolean) ?? [];
  const initialSeverity = initialFilters?.severity?.split(',').filter(Boolean) ?? [];
  const tileUnassigned = initialFilters?.unassigned === '1';
  const tileCritical = initialFilters?.critical === '1';
  const tileNeedsInfo = initialFilters?.needs_info === '1';
  const tileNew24h = initialFilters?.new24h === '1';
  const tileNew7d = initialFilters?.new7d === '1';
  const tileOverSla = initialFilters?.over_sla === '1';

  const riskSummary = useMemo(() => {
    const now = Date.now();
    const ms24h = 24 * 60 * 60 * 1000;
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    return {
      criticalOpen: reports.filter((r) => r.severity === 'CRITICAL' && isOpenReport(r)).length,
      unassigned: reports.filter((r) => !r.assignedTo && isOpenReport(r)).length,
      needsResponse: reports.filter((r) => r.status === 'NEEDS_INFO').length,
      new24h: reports.filter((r) => {
        const t = (r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt))).getTime();
        return now - t <= ms24h;
      }).length,
      new7d: reports.filter((r) => {
        const t = (r.createdAt instanceof Date ? r.createdAt : new Date(String(r.createdAt))).getTime();
        return now - t <= ms7d;
      }).length,
      overSla: reports.filter((r) => isOpenReport(r) && isOverSla(r)).length,
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports
      .filter((report) => {
        const text = `${report.id} ${report.summary} ${report.description} ${report.category}`.toLowerCase();
        const matchesQuery = !query || text.includes(query.toLowerCase());
        const matchesDate = inDateRange(report.updatedAt ?? report.createdAt, dateRange);
        const matchesStatus =
          initialStatus.length > 0 ? initialStatus.includes(report.status) : statusFilter === 'ALL' || report.status === statusFilter;
        const matchesSeverity =
          initialSeverity.length > 0 ? initialSeverity.includes(report.severity) : severityFilter === 'ALL' || report.severity === severityFilter;
        if (tileUnassigned && report.assignedTo) return false;
        if (tileCritical && (report.severity !== 'CRITICAL' || !isOpenReport(report))) return false;
        if (tileNeedsInfo && report.status !== 'NEEDS_INFO') return false;
        if (tileNew24h) {
          const t = (report.createdAt instanceof Date ? report.createdAt : new Date(String(report.createdAt))).getTime();
          if (Date.now() - t > 24 * 60 * 60 * 1000) return false;
        }
        if (tileNew7d) {
          const t = (report.createdAt instanceof Date ? report.createdAt : new Date(String(report.createdAt))).getTime();
          if (Date.now() - t > 7 * 24 * 60 * 60 * 1000) return false;
        }
        if (tileOverSla && (!isOpenReport(report) || !isOverSla(report))) return false;
        return matchesQuery && matchesDate && matchesStatus && matchesSeverity;
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }, [reports, query, dateRange, statusFilter, severityFilter, initialStatus, initialSeverity, tileUnassigned, tileCritical, tileNeedsInfo, tileNew24h, tileNew7d, tileOverSla]);

  const toggleRow = (id: string) => {
    setSelectedRows((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (selectedRows.length === filteredReports.length) {
      setSelectedRows([]);
      return;
    }
    setSelectedRows(filteredReports.map((report) => report.id));
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

  const applyTile = (params: Record<string, string>) => {
    onNavigate('reports', params);
  };
  const clearTile = () => {
    onNavigate('reports', {});
  };

  return (
    <div className="space-y-5">
      <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-5 py-4">
        <h1 className="mismo-heading text-3xl text-[var(--color-primary-900)]">Case Register</h1>
        <p className="mt-1 text-[var(--color-text-secondary)]">
          Structured report intake, procedural status control, and investigator assignment.
        </p>
      </div>

      {/* Risk Summary Bar – clickable tiles deep-link to filtered table */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => applyTile(tileCritical ? {} : { critical: '1' })}
          className={`p-3 border text-left rounded-lg transition-colors ${tileCritical ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]' : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)]'}`}
        >
          <p className="text-xs text-[var(--color-text-muted)] uppercase">Critical Open</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{riskSummary.criticalOpen}</p>
        </button>
        <button
          type="button"
          onClick={() => applyTile(tileUnassigned ? {} : { unassigned: '1' })}
          className={`p-3 border text-left rounded-lg transition-colors ${tileUnassigned ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]' : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)]'}`}
        >
          <p className="text-xs text-[var(--color-text-muted)] uppercase">Unassigned</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{riskSummary.unassigned}</p>
        </button>
        <button
          type="button"
          onClick={() => applyTile(tileNeedsInfo ? {} : { needs_info: '1' })}
          className={`p-3 border text-left rounded-lg transition-colors ${tileNeedsInfo ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]' : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)]'}`}
        >
          <p className="text-xs text-[var(--color-text-muted)] uppercase">Needs Response</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{riskSummary.needsResponse}</p>
        </button>
        <button
          type="button"
          onClick={() => applyTile(tileNew24h ? {} : { new24h: '1' })}
          className={`p-3 border text-left rounded-lg transition-colors ${tileNew24h ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]' : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)]'}`}
        >
          <p className="text-xs text-[var(--color-text-muted)] uppercase">New (24h)</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{riskSummary.new24h}</p>
        </button>
        <button
          type="button"
          onClick={() => applyTile(tileNew7d ? {} : { new7d: '1' })}
          className={`p-3 border text-left rounded-lg transition-colors ${tileNew7d ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]' : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)]'}`}
        >
          <p className="text-xs text-[var(--color-text-muted)] uppercase">New (7d)</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{riskSummary.new7d}</p>
        </button>
        <button
          type="button"
          onClick={() => applyTile(tileOverSla ? {} : { over_sla: '1' })}
          className={`p-3 border text-left rounded-lg transition-colors ${tileOverSla ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]' : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)]'}`}
        >
          <p className="text-xs text-[var(--color-text-muted)] uppercase">Over SLA</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{riskSummary.overSla}</p>
        </button>
      </div>
      {(tileUnassigned || tileCritical || tileNeedsInfo || tileNew24h || tileNew7d || tileOverSla) && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Filter active. <button type="button" onClick={clearTile} className="text-[var(--mismo-blue)] hover:underline">Clear filter</button>
        </p>
      )}

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3">
            <div className="relative">
              <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
                placeholder="Search case ID, summary, description, or category..."
              />
            </div>
            <select
              className="border border-[var(--color-border-200)] px-3 py-2 bg-white text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ReportStatus | 'ALL')}
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
              onChange={(event) => setSeverityFilter(event.target.value as ReportSeverity | 'ALL')}
            >
              <option value="ALL">All severities</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <DateRangeFilter value={dateRange} onChange={setDateRange} />

          {selectedRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 bg-[var(--color-surface-200)] border border-[var(--color-border-200)] px-3 py-2">
              <span className="text-sm text-[var(--color-text-secondary)]">{selectedRows.length} selected</span>
              <Button size="sm" variant="outline" onClick={bulkAssign}>Assign to me</Button>
              <Button size="sm" variant="outline" onClick={() => bulkStatus('TRIAGED')}>Mark triaged</Button>
              <Button size="sm" variant="outline" onClick={() => bulkStatus('IN_REVIEW')}>Mark in review</Button>
              <Button size="sm" variant="outline" onClick={() => bulkStatus('NEEDS_INFO')}>Request info</Button>
              <Button size="sm" variant="outline" onClick={() => { selectedRows.forEach((id) => { const r = reports.find(report => report.id === id); if (r && !r.investigationId && r.status !== 'NEW') createInvestigation(id, dataStore.currentUser.id); }); setSelectedRows([]); toast.success('Investigations created for selected reports.'); }}>Convert to investigation</Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedRows([])}>Clear</Button>
            </div>
          )}

          <div className="overflow-x-auto border border-[var(--color-border-200)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <input
                      type="checkbox"
                      checked={filteredReports.length > 0 && selectedRows.length === filteredReports.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-2 text-left">Case</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Severity</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Assigned</th>
                  <th className="px-3 py-2 text-left">Last Updated</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => {
                  const assignee = report.assignedTo ? users.find((user) => user.id === report.assignedTo) : null;
                  return (
                    <tr key={report.id} className="border-t border-[var(--color-border-200)]">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(report.id)}
                          onChange={() => toggleRow(report.id)}
                        />
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
                                <DropdownMenuItem onClick={() => {
                                  const inv = createInvestigation(report.id, dataStore.currentUser.id);
                                  if (inv) { toast.success('Investigation created and linked.'); onNavigate('investigation-detail', { id: inv.id }); }
                                }}>
                                  Convert to investigation
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => { updateReportStatus(report.id, 'NEEDS_INFO'); toast.success('Status set to Needs info.'); }}>
                                Request info
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onNavigate('report-detail', { id: report.id })}>
                                Export evidence
                              </DropdownMenuItem>
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

          {filteredReports.length === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              No case records match the current filter window.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
