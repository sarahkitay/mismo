import { useEffect, useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { Investigation } from '@/types';
import { Icons } from '@/lib/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { getEffectiveStage, getInvestigationDisplayId, INVESTIGATION_STAGE_LABELS } from '@/lib/investigationWorkflow';
import { downloadCsv } from '@/lib/exportCsv';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const INV_SLA_DAYS = 14;

function getInvAgeDays(openedAt: Date): number {
  const t = openedAt instanceof Date ? openedAt.getTime() : new Date(String(openedAt)).getTime();
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

function isOverSla(inv: Investigation): boolean {
  return inv.status === 'OPEN' && getInvAgeDays(inv.openedAt) > INV_SLA_DAYS;
}

interface AdminInvestigationsProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
}

export function AdminInvestigations({ dataStore, onNavigate, initialFilters }: AdminInvestigationsProps) {
  const { investigations, reports, users, currentUser } = dataStore;
  
  const tileFromUrl = initialFilters?.tile ?? '';
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'CLOSED' | 'ASSIGNED_TO_ME'>(
    initialFilters?.status === 'OPEN' ? 'OPEN' : tileFromUrl === 'open' || tileFromUrl === 'over_sla' || tileFromUrl === 'awaiting_interview' || tileFromUrl === 'awaiting_doc' || tileFromUrl === 'ready_to_close' ? 'OPEN' : 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');
  
  const riskSummary = useMemo(() => {
    const open = investigations.filter((i) => i.status === 'OPEN');
    const openWithLinkedReports = open.map((inv) => ({
      inv,
      linked: inv.linkedReportIds.map((id) => reports.find((r) => r.id === id)).filter(Boolean) as { status: string }[],
    }));
    const awaitingInterview = openWithLinkedReports.filter(
      ({ linked }) => linked.some((r) => r.status === 'NEEDS_INFO')
    ).length;
    const awaitingDoc = openWithLinkedReports.filter(
      ({ linked }) => linked.some((r) => ['ASSIGNED', 'IN_REVIEW', 'TRIAGED', 'NEW'].includes(r.status))
    ).length;
    const readyToClose = openWithLinkedReports.filter(
      ({ linked }) => linked.length > 0 && linked.every((r) => ['RESOLVED', 'CLOSED'].includes(r.status))
    ).length;
    return {
      open: open.length,
      overSla: open.filter(isOverSla).length,
      awaitingInterview,
      awaitingDoc,
      readyToClose,
    };
  }, [investigations, reports]);

  const filteredInvestigations = useMemo(() => {
    return investigations.filter(inv => {
      const matchesStatus = 
        filter === 'ALL' || 
        (filter === 'OPEN' && inv.status === 'OPEN') ||
        (filter === 'CLOSED' && inv.status === 'CLOSED') ||
        (filter === 'ASSIGNED_TO_ME' && inv.ownerId === currentUser.id);
      
      const linked = inv.linkedReportIds.map((id) => reports.find((r) => r.id === id)).filter(Boolean) as { status: string }[];
      const matchesTile = 
        !tileFromUrl ||
        (tileFromUrl === 'open' && inv.status === 'OPEN') ||
        (tileFromUrl === 'over_sla' && inv.status === 'OPEN' && isOverSla(inv)) ||
        (tileFromUrl === 'awaiting_interview' && inv.status === 'OPEN' && linked.some((r) => r.status === 'NEEDS_INFO')) ||
        (tileFromUrl === 'awaiting_doc' && inv.status === 'OPEN' && linked.some((r) => ['ASSIGNED', 'IN_REVIEW', 'TRIAGED', 'NEW'].includes(r.status))) ||
        (tileFromUrl === 'ready_to_close' && inv.status === 'OPEN' && linked.length > 0 && linked.every((r) => ['RESOLVED', 'CLOSED'].includes(r.status)));
      
      const matchesSearch = searchQuery === '' || 
        inv.linkedReportIds.some(reportId => {
          const report = reports.find(r => r.id === reportId);
          return report && (
            report.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
            report.description.toLowerCase().includes(searchQuery.toLowerCase())
          );
        });
      
      return matchesStatus && matchesTile && matchesSearch;
    });
  }, [investigations, filter, tileFromUrl, searchQuery, reports, currentUser.id]);

  useEffect(() => {
    if (tileFromUrl && ['open', 'over_sla', 'awaiting_interview', 'awaiting_doc', 'ready_to_close'].includes(tileFromUrl)) {
      setFilter('OPEN');
    }
  }, [tileFromUrl]);

  const applyTile = (tile: string) => {
    if (tileFromUrl === tile) {
      onNavigate('investigations', {});
      setFilter('ALL');
    } else {
      onNavigate('investigations', { tile });
      setFilter(['open', 'over_sla', 'awaiting_interview', 'awaiting_doc', 'ready_to_close'].includes(tile) ? 'OPEN' : 'ALL');
    }
  };
  const clearTile = () => {
    onNavigate('investigations', {});
    setFilter('ALL');
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="investigations-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="mismo-heading text-3xl text-[var(--color-primary-900)]">Investigations</h1>
          <p className="text-[var(--mismo-text-secondary)] mt-1">
            Structured case management for active and closed investigations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const headers = [
                'Reference',
                'Employee',
                'Initiated',
                'Modified',
                'Investigator',
                'Status',
                'Stage',
                'Documents',
                'Notes',
                'Findings',
              ];
              const rows = filteredInvestigations.map((inv) => {
                const subject = inv.subjectUserIds?.[0] ? users.find((u) => u.id === inv.subjectUserIds![0]) : null;
                const investigator = users.find((u) => u.id === inv.ownerId);
                const noteCount = inv.notes?.length ?? 0;
                const docCount =
                  (inv.notes ?? []).reduce((sum, n) => sum + (n.attachments?.length ?? 0), 0) + (inv.outcomeAttachment ? 1 : 0);
                return [
                  inv.referenceNumber ?? inv.id,
                  subject ? `${subject.firstName} ${subject.lastName}` : '-',
                  formatDate(inv.openedAt),
                  formatDate(inv.updatedAt),
                  investigator ? `${investigator.firstName} ${investigator.lastName}` : 'Unassigned',
                  inv.status,
                  INVESTIGATION_STAGE_LABELS[getEffectiveStage(inv)],
                  docCount,
                  noteCount,
                  inv.outcomeSummary?.slice(0, 80) ?? '',
                ];
              });
              downloadCsv(`mismo-investigations-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
              toast.success('Investigations register exported.');
            }}
          >
            Export CSV
          </Button>
          <span className="text-sm text-[var(--mismo-text-secondary)]">
            {filteredInvestigations.length} investigations
          </span>
        </div>
      </div>

      {/* Risk Summary Bar – clickable tiles deep-link to filtered list */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="group" aria-label="Risk summary filters">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); applyTile('open'); }}
          className={`p-3 border text-left rounded-lg transition-colors cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[var(--mismo-blue)] focus:ring-offset-1 ${tileFromUrl === 'open' ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]' : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)] hover:border-[var(--color-border-200)]'}`}
          aria-pressed={tileFromUrl === 'open'}
        >
          <p className="text-xs text-[var(--color-text-muted)] uppercase">Open Investigations</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{riskSummary.open}</p>
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); applyTile('over_sla'); }}
          className={`p-3 border text-left rounded-lg transition-colors cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[var(--mismo-blue)] focus:ring-offset-1 ${tileFromUrl === 'over_sla' ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]' : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)] hover:border-[var(--color-border-200)]'}`}
          aria-pressed={tileFromUrl === 'over_sla'}
        >
          <p className="text-xs text-[var(--color-text-muted)] uppercase">Over SLA</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{riskSummary.overSla}</p>
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); applyTile('awaiting_interview'); }}
          className={`p-3 border text-left rounded-lg transition-colors cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[var(--mismo-blue)] focus:ring-offset-1 ${tileFromUrl === 'awaiting_interview' ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]' : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)] hover:border-[var(--color-border-200)]'}`}
          aria-pressed={tileFromUrl === 'awaiting_interview'}
        >
          <p className="text-xs text-[var(--color-text-muted)] uppercase">Awaiting Interview</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{riskSummary.awaitingInterview}</p>
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); applyTile('awaiting_doc'); }}
          className={`p-3 border text-left rounded-lg transition-colors cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[var(--mismo-blue)] focus:ring-offset-1 ${tileFromUrl === 'awaiting_doc' ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]' : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)] hover:border-[var(--color-border-200)]'}`}
          aria-pressed={tileFromUrl === 'awaiting_doc'}
        >
          <p className="text-xs text-[var(--color-text-muted)] uppercase">Awaiting Documentation</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{riskSummary.awaitingDoc}</p>
        </button>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); applyTile('ready_to_close'); }}
          className={`p-3 border text-left rounded-lg transition-colors cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[var(--mismo-blue)] focus:ring-offset-1 ${tileFromUrl === 'ready_to_close' ? 'border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]' : 'border-[var(--color-border-200)] bg-white hover:bg-[var(--color-surface-200)] hover:border-[var(--color-border-200)]'}`}
          aria-pressed={tileFromUrl === 'ready_to_close'}
        >
          <p className="text-xs text-[var(--color-text-muted)] uppercase">Ready to Close</p>
          <p className="text-xl font-semibold text-[var(--color-text-primary)]">{riskSummary.readyToClose}</p>
        </button>
      </div>
      {tileFromUrl && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Filter active.{' '}
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearTile(); }} className="text-[var(--mismo-blue)] hover:underline cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--mismo-blue)] rounded px-1" aria-label="Clear filter">
            Clear filter
          </button>
        </p>
      )}
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search investigations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Status Filter */}
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Investigations</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
            <SelectItem value="ASSIGNED_TO_ME">Assigned to Me</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Investigations register */}
      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-0 overflow-x-auto">
          {filteredInvestigations.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-3 py-2 text-left">Investigation #</th>
                  <th className="px-3 py-2 text-left">Employee</th>
                  <th className="px-3 py-2 text-left">Initiated</th>
                  <th className="px-3 py-2 text-left">Modified</th>
                  <th className="px-3 py-2 text-left">Investigator</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Stage</th>
                  <th className="px-3 py-2 text-left">Report against</th>
                  <th className="px-3 py-2 text-left">Docs</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                  <th className="px-3 py-2 text-left">Findings</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestigations.map((investigation) => {
                  const owner = users.find((u) => u.id === investigation.ownerId);
                  const subject = investigation.subjectUserIds?.[0]
                    ? users.find((u) => u.id === investigation.subjectUserIds![0])
                    : null;
                  const noteCount = investigation.notes?.length ?? 0;
                  const docCount =
                    (investigation.notes ?? []).reduce((sum, n) => sum + (n.attachments?.length ?? 0), 0) +
                    (investigation.outcomeAttachment ? 1 : 0);
                  const stage = getEffectiveStage(investigation);
                  return (
                    <tr
                      key={investigation.id}
                      className="border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)] cursor-pointer"
                      onClick={() => onNavigate('investigation-detail', { id: investigation.id })}
                    >
                      <td className="px-3 py-2 font-medium whitespace-nowrap">
                        {getInvestigationDisplayId(investigation)}
                      </td>
                      <td className="px-3 py-2">
                        {subject ? (
                          <button
                            type="button"
                            className="text-[var(--mismo-blue)] hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigate('employee-detail', { id: subject.id });
                            }}
                          >
                            {subject.firstName} {subject.lastName}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(investigation.openedAt)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatRelativeTime(investigation.updatedAt)}</td>
                      <td className="px-3 py-2">{owner ? `${owner.firstName} ${owner.lastName}` : 'Unassigned'}</td>
                      <td className="px-3 py-2">
                        <Badge className={investigation.status === 'OPEN' ? 'status-chip status-chip--warn' : 'status-chip status-chip--success'}>
                          {investigation.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">{INVESTIGATION_STAGE_LABELS[stage]}</td>
                      <td className="px-3 py-2 max-w-[120px] truncate">
                        {investigation.subjectUserIds?.length
                          ? investigation.subjectUserIds
                              .map((id) => {
                                const u = users.find((x) => x.id === id);
                                return u ? `${u.firstName} ${u.lastName}` : id;
                              })
                              .join(', ')
                          : '-'}
                      </td>
                      <td className="px-3 py-2">{docCount}</td>
                      <td className="px-3 py-2">{noteCount}</td>
                      <td className="px-3 py-2 max-w-[140px] truncate text-xs text-[var(--color-text-secondary)]">
                        {investigation.outcomeSummary ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('investigation-detail', { id: investigation.id });
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center">
              <Icons.searchX className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--mismo-text)] mb-2">No investigations found</h3>
              <p className="text-[var(--mismo-text-secondary)] max-w-md mx-auto">
                {searchQuery
                  ? 'No investigations match your search criteria.'
                  : 'There are no investigations matching the selected filter. Open investigations from the case register when escalation is required.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
