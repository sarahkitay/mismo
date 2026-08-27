import { useEffect, useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { ReportSeverity, ReportStatus } from '@/types';
import {
  deriveBucket,
  isOpenReport,
  isOverSla,
  isUnderOpenInvestigation,
} from '@/lib/caseRegisterModel';
import { downloadCsv } from '@/lib/exportCsv';
import { PageMoreInfo } from '@/components/PageMoreInfo';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { defaultDateRange, inDateRange, type DateRangeState } from '@/lib/dateFilters';
import {
  getCategoryLabel,
  formatRelativeTime,
  formatDate,
  isIncidentIntakeComplete,
  getEffectiveInvestigationPhase,
  investigationWorkflowLabel,
  getSeverityColor,
  getStatusColor,
} from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CASE_TYPE_LABELS, MARK_INITIAL_REVIEW_ACTION, MARK_INITIAL_REVIEW_TOAST, formatCaseReference, getCaseTypeShortLabel, getReportStatusLabel, getReportStatusShortLabel, inferCaseType } from '@/lib/caseTypes';
import { Icons } from '@/lib/icons';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BucketBtn, Tile } from '@/components/admin/caseRegisterControls';

import {
  linkedReportForPromptRow,
  promptResponseForReport,
  answerLabel,
  findInvestigationForReport,
} from '@/lib/recordLinks';
import {
  buildEmployeePromptRegisterRows,
  exportEmployeePromptRegisterCsv,
} from '@/lib/employeePromptRegister';
import { getInvestigationDisplayId } from '@/lib/investigationWorkflow';

type PromptChannel = 'incident' | 'wage_hour' | 'memo' | 'register';

interface AdminCaseRegisterHubProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
  /** Which sidebar route filters apply to */
  hubPage?: 'prompt-responses' | 'case-register';
}

export function AdminCaseRegisterHub({ dataStore, onNavigate, initialFilters, hubPage = 'prompt-responses' }: AdminCaseRegisterHubProps) {
  const filters = initialFilters ?? {};
  const { reports, users, investigations, deliveries, responses, prompts, assignReport, updateReportStatus, createInvestigation } = dataStore;

  const bucket = deriveBucket(filters, hubPage);
  const promptChannel: PromptChannel =
    filters.channel === 'wage_hour' || filters.channel === 'memo' || filters.channel === 'register'
      ? (filters.channel as PromptChannel)
      : filters.channel === 'incident'
        ? 'incident'
        : hubPage === 'case-register'
          ? 'register'
          : 'incident';
  const needsReviewOnly = filters.needs_review === '1';
  const filterKey = JSON.stringify(filters);

  const [query, setQuery] = useState('');
  const [promptQuery, setPromptQuery] = useState('');
  const [range, setRange] = useState<DateRangeState>(() => ({
    ...defaultDateRange,
    preset: (filters.rangePreset as DateRangeState['preset'] | undefined) ?? 'ALL',
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  }));
  useEffect(() => {
    setRange({
      ...defaultDateRange,
      preset: (filters.rangePreset as DateRangeState['preset'] | undefined) ?? 'ALL',
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    });
  }, [filterKey]);
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
  const tileOpenOnly = filters.open === '1';
  const caseTypeFilter =
    filters.caseType ?? (promptChannel === 'wage_hour' ? 'WAGE_HOUR' : 'ALL');

  const registerReports = useMemo(
    () => reports.filter((r) => !isUnderOpenInvestigation(r, investigations)),
    [reports, investigations]
  );

  const promptIdsForChannel = useMemo(() => {
    if (promptChannel === 'incident') {
      return new Set(prompts.filter((p) => p.type === 'INCIDENT').map((p) => p.id));
    }
    if (promptChannel === 'wage_hour') {
      return new Set(
        prompts.filter((p) => p.includeFinancialQuestion || p.title.toLowerCase().includes('wage')).map((p) => p.id)
      );
    }
    return new Set(prompts.map((p) => p.id));
  }, [prompts, promptChannel]);

  const incidentPromptIds = useMemo(
    () => new Set(prompts.filter((p) => p.type === 'INCIDENT').map((p) => p.id)),
    [prompts]
  );

  const employeeIdFilter = filters.employeeId;
  const filterEmployee = employeeIdFilter ? users.find((u) => u.id === employeeIdFilter) : undefined;

  const employeeScopedReports = useMemo(() => {
    if (!employeeIdFilter) return registerReports;
    return registerReports.filter((report) => report.createdByUserId === employeeIdFilter);
  }, [registerReports, employeeIdFilter]);

  const riskSummary = useMemo(() => {
    const now = Date.now();
    const ms24h = 24 * 60 * 60 * 1000;
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    const base = employeeScopedReports;
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
  }, [employeeScopedReports]);

  const orgUnansweredCount = useMemo(
    () =>
      deliveries.filter((d) => {
        if (d.status !== 'PENDING') return false;
        if (!incidentPromptIds.has(d.promptId)) return false;
        const user = users.find((u) => u.id === d.userId);
        if (!user || user.role !== 'EMPLOYEE' || user.status !== 'active') return false;
        const prompt = prompts.find((p) => p.id === d.promptId);
        if (!prompt || prompt.status !== 'ACTIVE') return false;
        return true;
      }).length,
    [deliveries, users, prompts, incidentPromptIds]
  );

  const orgYesNeedingReviewCount = useMemo(
    () => responses.filter((r) => r.answer === 'HAS_ISSUE' && !r.reviewedAt && r.needsReview !== false).length,
    [responses]
  );

  const incidentBucketCounts = useMemo(() => {
    if (!employeeIdFilter) {
      return {
        yes: responses.filter(
          (r) => r.answer === 'HAS_ISSUE' && incidentPromptIds.has(r.promptId)
        ).length,
        yesNeedsReview: responses.filter(
          (r) =>
            r.answer === 'HAS_ISSUE' &&
            !r.reviewedAt &&
            r.needsReview !== false &&
            incidentPromptIds.has(r.promptId)
        ).length,
        no: responses.filter(
          (r) => r.answer === 'NO_ISSUE' && incidentPromptIds.has(r.promptId)
        ).length,
        unanswered: orgUnansweredCount,
      };
    }
    const rows = buildEmployeePromptRegisterRows(employeeIdFilter, users, deliveries, responses, prompts, {
      range,
      channelPromptIds: incidentPromptIds,
    });
    return {
      yes: rows.filter((r) => r.answer === 'HAS_ISSUE').length,
      yesNeedsReview: rows.filter((r) => r.answer === 'HAS_ISSUE' && r.needsReview).length,
      no: rows.filter((r) => r.answer === 'NO_ISSUE').length,
      unanswered: rows.filter((r) => r.answer === 'UNANSWERED').length,
    };
  }, [
    employeeIdFilter,
    users,
    deliveries,
    responses,
    prompts,
    range,
    incidentPromptIds,
    orgUnansweredCount,
  ]);

  const registerBucketCounts = useMemo(() => {
    const scoped = employeeScopedReports.filter((report) =>
      employeeIdFilter ? inDateRange(report.updatedAt ?? report.createdAt, range) : true
    );
    return {
      openCases: scoped.filter((r) => isOpenReport(r)).length,
      wageHourCases: scoped.filter((r) => inferCaseType(r.category, r.caseType) === 'WAGE_HOUR').length,
    };
  }, [employeeScopedReports, employeeIdFilter, range]);

  const unansweredCount = employeeIdFilter ? incidentBucketCounts.unanswered : orgUnansweredCount;
  const yesNeedingReviewCount = employeeIdFilter ? incidentBucketCounts.yesNeedsReview : orgYesNeedingReviewCount;

  const reportSummary = useMemo(() => {
    const scoped = registerReports.filter((report) => {
      if (employeeIdFilter && report.createdByUserId !== employeeIdFilter) return false;
      return inDateRange(report.updatedAt ?? report.createdAt, range);
    });
    return {
      total: scoped.length,
      open: scoped.filter((report) => isOpenReport(report)).length,
      resolved: scoped.filter((report) => ['RESOLVED', 'CLOSED'].includes(report.status)).length,
    };
  }, [registerReports, range, employeeIdFilter]);

  const reportScopeAll =
    !tileOpenOnly &&
    initialStatus.length === 0 &&
    !tileCritical &&
    !tileUnassigned &&
    !tileNeedsInfo &&
    !tileNew24h &&
    !tileNew7d &&
    !tileOverSla;

  const promptRows = useMemo(() => {
    if (bucket === 'CASE_REGISTER' || bucket === 'NEW_CRITICAL' || bucket === 'NEEDS_RESPONSE') return [];
    if (!employeeIdFilter && (promptChannel === 'memo' || promptChannel === 'register')) return [];
    const q = promptQuery.trim().toLowerCase();

    if (employeeIdFilter) {
      const ansFilter =
        bucket === 'PROMPT_YES'
          ? ('HAS_ISSUE' as const)
          : bucket === 'PROMPT_NO'
            ? ('NO_ISSUE' as const)
            : bucket === 'PROMPT_UNANSWERED'
              ? ('UNANSWERED' as const)
              : null;
      return buildEmployeePromptRegisterRows(employeeIdFilter, users, deliveries, responses, prompts, {
        range,
        answerFilter: ansFilter,
        needsReviewOnly: needsReviewOnly && bucket === 'PROMPT_YES',
      }).filter((row) => `${row.promptTitle} ${row.userName}`.toLowerCase().includes(q));
    }

    const sortRows = <T extends { modified: Date }>(rows: T[]) =>
      [...rows].sort((a, b) => b.modified.getTime() - a.modified.getTime());

    if (bucket === 'PROMPT_UNANSWERED') {
      return sortRows(
        deliveries
          .filter((d) => {
            if (d.status !== 'PENDING' || !inDateRange(d.deliveredAt, range) || !promptIdsForChannel.has(d.promptId)) {
              return false;
            }
            const user = users.find((u) => u.id === d.userId);
            if (!user || user.role !== 'EMPLOYEE' || user.status !== 'active') return false;
            const prompt = prompts.find((p) => p.id === d.promptId);
            return Boolean(prompt && prompt.status === 'ACTIVE');
          })
          .map((d) => {
            const u = users.find((user) => user.id === d.userId);
            const prompt = prompts.find((p) => p.id === d.promptId);
            return {
              id: d.id,
              deliveryId: d.id,
              userId: d.userId,
              promptTitle: prompt?.title ?? 'Prompt',
              promptType: prompt?.type ?? 'GENERAL',
              userName: u ? `${u.firstName} ${u.lastName}` : 'Employee',
              answer: 'UNANSWERED' as const,
              date: d.deliveredAt,
              modified: d.updatedAt ?? d.deliveredAt,
              needsReview: false,
            };
          })
          .filter((row) => `${row.promptTitle} ${row.userName}`.toLowerCase().includes(q))
      );
    }
    const ansFilter = bucket === 'PROMPT_YES' ? 'HAS_ISSUE' : bucket === 'PROMPT_NO' ? 'NO_ISSUE' : null;
    const answeredRows = sortRows(
      responses
        .filter((r) => inDateRange(r.createdAt, range) && promptIdsForChannel.has(r.promptId))
        .filter((r) => ansFilter === null || r.answer === ansFilter)
        .filter((r) => {
          if (!needsReviewOnly || bucket !== 'PROMPT_YES') return true;
          return r.answer === 'HAS_ISSUE' && !r.reviewedAt && r.needsReview !== false;
        })
        .map((r) => {
          const u = users.find((user) => user.id === r.userId);
          const prompt = prompts.find((p) => p.id === r.promptId);
          return {
            id: r.id,
            deliveryId: r.promptDeliveryId,
            userId: r.userId,
            promptTitle: prompt?.title ?? 'Prompt',
            promptType: prompt?.type ?? 'GENERAL',
            promptId: r.promptId,
            userName: u ? `${u.firstName} ${u.lastName}` : 'Employee',
            answer: r.answer,
            date: r.submittedAt,
            modified: r.updatedAt ?? r.submittedAt,
            needsReview: r.answer === 'HAS_ISSUE' && !r.reviewedAt && r.needsReview !== false,
          };
        })
        .filter((row) => `${row.promptTitle} ${row.userName}`.toLowerCase().includes(q))
    );
    // Default "all" view: include unanswered employee check-ins so the list matches the nav badge.
    if (bucket === 'PROMPT_ALL' && !needsReviewOnly) {
      const unansweredRows = sortRows(
        deliveries
          .filter((d) => {
            if (d.status !== 'PENDING' || !inDateRange(d.deliveredAt, range) || !promptIdsForChannel.has(d.promptId)) {
              return false;
            }
            const user = users.find((u) => u.id === d.userId);
            if (!user || user.role !== 'EMPLOYEE' || user.status !== 'active') return false;
            const prompt = prompts.find((p) => p.id === d.promptId);
            return Boolean(prompt && prompt.status === 'ACTIVE');
          })
          .map((d) => {
            const u = users.find((user) => user.id === d.userId);
            const prompt = prompts.find((p) => p.id === d.promptId);
            return {
              id: d.id,
              deliveryId: d.id,
              userId: d.userId,
              promptTitle: prompt?.title ?? 'Prompt',
              promptType: prompt?.type ?? 'GENERAL',
              userName: u ? `${u.firstName} ${u.lastName}` : 'Employee',
              answer: 'UNANSWERED' as const,
              date: d.deliveredAt,
              modified: d.updatedAt ?? d.deliveredAt,
              needsReview: false,
            };
          })
          .filter((row) => `${row.promptTitle} ${row.userName}`.toLowerCase().includes(q))
      );
      return sortRows([...answeredRows, ...unansweredRows]);
    }
    return answeredRows;
  }, [bucket, deliveries, responses, prompts, users, range, promptQuery, needsReviewOnly, promptChannel, promptIdsForChannel, employeeIdFilter]);

  const filteredRegisterReports = useMemo(() => {
    const ms24h = 24 * 60 * 60 * 1000;
    const ms7d = 7 * 24 * 60 * 60 * 1000;
    return registerReports
      .filter((report) => {
        if (employeeIdFilter && report.createdByUserId !== employeeIdFilter) return false;
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
        if (tileOpenOnly && !isOpenReport(report)) return false;
        if (caseTypeFilter !== 'ALL') {
          const ct = inferCaseType(report.category, report.caseType);
          if (ct !== caseTypeFilter) return false;
        }
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
    tileOpenOnly,
    caseTypeFilter,
    employeeIdFilter,
  ]);

  const applyTile = (params: Record<string, string>) => {
    goRegister(params);
  };
  const clearTile = () => goRegister({});
  const goPrompt = (params: Record<string, string>) =>
    onNavigate('prompt-responses', {
      view: 'prompts',
      channel: promptChannel === 'register' ? 'incident' : promptChannel,
      ...(employeeIdFilter ? { employeeId: employeeIdFilter } : {}),
      ...params,
    });
  const goRegister = (params: Record<string, string>) =>
    onNavigate('prompt-responses', {
      view: 'register',
      register: '1',
      channel: 'register',
      ...(employeeIdFilter ? { employeeId: employeeIdFilter } : {}),
      ...params,
    });
  const openEmployeeRegister = (userId: string) =>
    onNavigate('prompt-responses', {
      view: 'prompts',
      employeeId: userId,
      rangePreset: range.preset,
      ...(range.startDate ? { startDate: range.startDate } : {}),
      ...(range.endDate ? { endDate: range.endDate } : {}),
      channel: 'incident',
    });

  const showCaseTable =
    promptChannel === 'register' ||
    promptChannel === 'wage_hour' ||
    bucket === 'CASE_REGISTER' ||
    bucket === 'NEW_CRITICAL' ||
    bucket === 'NEEDS_RESPONSE';
  const showPromptList =
    Boolean(employeeIdFilter) ||
    (promptChannel !== 'register' &&
      promptChannel !== 'memo' &&
      promptChannel !== 'wage_hour' &&
      (bucket === 'PROMPT_ALL' || bucket === 'PROMPT_YES' || bucket === 'PROMPT_NO' || bucket === 'PROMPT_UNANSWERED'));

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
        <h1 className="mismo-heading text-3xl text-[var(--color-primary-900)]">Prompt responses</h1>
        <PageMoreInfo>
          Scheduled check-in answers and the <strong>case register</strong> in one place.{' '}
          <strong>Prompt responses</strong> are check-in answers (Yes, No, unanswered).{' '}
          <strong>Case register</strong> items are reports and escalations (from a Yes response, incident intake, memo
          clarification, or manual entry) that HR triages here. Escalations may become{' '}
          <button
            type="button"
            className="text-[var(--mismo-blue)] hover:underline font-medium"
            onClick={() => onNavigate('investigations')}
          >
            Investigations
          </button>
          . Cases linked to an open investigation are hidden from this register until closed.
        </PageMoreInfo>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile
          active={reportScopeAll && promptChannel === 'register'}
          onClick={() => goRegister({})}
          label="Total reports"
          value={reportSummary.total}
        />
        <Tile
          active={tileOpenOnly}
          onClick={() => goRegister(tileOpenOnly ? {} : { open: '1' })}
          label="Open reports"
          value={reportSummary.open}
        />
        <Tile
          active={initialStatus.includes('RESOLVED') || initialStatus.includes('CLOSED')}
          onClick={() =>
            goRegister(
              initialStatus.includes('RESOLVED') || initialStatus.includes('CLOSED')
                ? {}
                : { status: 'RESOLVED,CLOSED' }
            )
          }
          label="Resolved reports"
          value={reportSummary.resolved}
        />
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-2">
            {filterEmployee
              ? `Issue responses for ${filterEmployee.firstName} ${filterEmployee.lastName}`
              : 'Issue responses (incident query)'}
          </p>
          <div className="flex flex-wrap gap-2">
            <BucketBtn
              active={promptChannel === 'incident' && bucket === 'PROMPT_YES' && !needsReviewOnly}
              onClick={() => goPrompt({ channel: 'incident', answer: 'HAS_ISSUE', rangePreset: filters.rangePreset ?? 'ALL' })}
            >
              Yes ({incidentBucketCounts.yes})
            </BucketBtn>
            <BucketBtn
              active={promptChannel === 'incident' && bucket === 'PROMPT_YES' && needsReviewOnly}
              onClick={() => goPrompt({ channel: 'incident', answer: 'HAS_ISSUE', needs_review: '1', rangePreset: filters.rangePreset ?? 'ALL' })}
            >
              Yes · needs review ({yesNeedingReviewCount})
            </BucketBtn>
            <BucketBtn
              active={promptChannel === 'incident' && bucket === 'PROMPT_NO'}
              onClick={() => goPrompt({ channel: 'incident', answer: 'NO_ISSUE', rangePreset: filters.rangePreset ?? 'ALL' })}
            >
              No ({incidentBucketCounts.no})
            </BucketBtn>
            <BucketBtn
              active={promptChannel === 'incident' && bucket === 'PROMPT_UNANSWERED'}
              onClick={() => goPrompt({ channel: 'incident', bucket: 'UNANSWERED', rangePreset: filters.rangePreset ?? 'ALL' })}
            >
              Unanswered ({unansweredCount})
            </BucketBtn>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-2">Wage &amp; hour responses</p>
          <div className="flex flex-wrap gap-2">
            <BucketBtn
              active={promptChannel === 'wage_hour'}
              onClick={() =>
                onNavigate('prompt-responses', {
                  view: 'register',
                  register: '1',
                  channel: 'wage_hour',
                  caseType: 'WAGE_HOUR',
                  rangePreset: filters.rangePreset ?? 'ALL',
                  ...(employeeIdFilter ? { employeeId: employeeIdFilter } : {}),
                })
              }
            >
              Wage &amp; hour cases ({registerBucketCounts.wageHourCases})
            </BucketBtn>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)] mb-2">Case register</p>
          <div className="flex flex-wrap gap-2">
            <BucketBtn active={promptChannel === 'register' && bucket === 'CASE_REGISTER'} onClick={() => goRegister({})}>
              All open cases ({registerBucketCounts.openCases})
            </BucketBtn>
            <BucketBtn active={bucket === 'NEW_CRITICAL'} onClick={() => goRegister({ critical: '1' })}>
              New critical
            </BucketBtn>
            <BucketBtn active={bucket === 'NEEDS_RESPONSE'} onClick={() => goRegister({ needs_info: '1' })}>
              Needs clarification
            </BucketBtn>
          </div>
        </div>
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

      {showPromptList && filterEmployee && (
        <Card className="mismo-card border border-[var(--color-primary-700)] bg-[var(--mismo-blue-light)]/20">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Employee check-in register</p>
              <p className="font-medium text-[var(--mismo-text)]">
                {filterEmployee.firstName} {filterEmployee.lastName}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                All prompt answers, pending check-ins, and linked case escalations for this employee. Export for audit or reporting.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={() => onNavigate('employee-detail', { id: filterEmployee.id, tab: 'prompts' })}>
                Employee profile
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const exportData = exportEmployeePromptRegisterCsv(
                    promptRows,
                    reports,
                    `${filterEmployee.firstName} ${filterEmployee.lastName}`,
                    filterEmployee.employeeId ?? filterEmployee.id
                  );
                  downloadCsv(exportData.filename, exportData.headers, exportData.rows);
                  toast.success('Employee check-in report exported.');
                }}
              >
                Export CSV
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onNavigate('prompt-responses', { view: 'prompts', channel: 'incident', rangePreset: 'ALL' })}
              >
                Clear employee filter
              </Button>
            </div>
          </CardContent>
        </Card>
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
                <option value="TRIAGED">Initial review complete</option>
                <option value="ASSIGNED">ASSIGNED</option>
                <option value="IN_REVIEW">IN REVIEW</option>
                <option value="NEEDS_INFO">NEEDS INFO</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
              <select
                className="border border-[var(--color-border-200)] px-3 py-2 bg-white text-sm"
                value={caseTypeFilter}
                onChange={(e) => goRegister({ caseType: e.target.value })}
              >
                <option value="ALL">All case types</option>
                <option value="WORKPLACE_INVESTIGATION">Workplace</option>
                <option value="WAGE_HOUR">Wage &amp; hour</option>
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
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
              <DateRangeFilter value={range} onChange={setRange} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  const headers = [
                    'Case ID',
                    'Reported date',
                    'Employee',
                    'Category',
                    'Severity',
                    'Status',
                    'Assigned',
                    'Last updated',
                  ];
                  const rows = filteredRegisterReports.map((r) => {
                    const reporter = r.createdByUserId ? users.find((u) => u.id === r.createdByUserId) : null;
                    const assignee = r.assignedTo ? users.find((u) => u.id === r.assignedTo) : null;
                    return [
                      r.id,
                      formatDate(r.createdAt),
                      r.isAnonymous ? 'Anonymous' : reporter ? `${reporter.firstName} ${reporter.lastName}` : '-',
                      r.category,
                      r.severity,
                      r.status,
                      assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned',
                      formatDate(r.updatedAt),
                    ];
                  });
                  downloadCsv(`mismo-case-register-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
                  toast.success('Case register CSV downloaded.');
                }}
              >
                Export CSV
              </Button>
            </div>
            {selectedRows.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 bg-[var(--color-surface-200)] border border-[var(--color-border-200)] px-3 py-2">
                <span className="text-sm text-[var(--color-text-secondary)]">{selectedRows.length} selected</span>
                <Button size="sm" variant="outline" onClick={bulkAssign}>
                  Assign to me
                </Button>
                <Button size="sm" variant="outline" onClick={() => bulkStatus('TRIAGED')}>
                  {MARK_INITIAL_REVIEW_ACTION}
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
                      if (r && !r.investigationId) createInvestigation(id, dataStore.currentUser.id);
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

            <div className="border border-[var(--color-border-200)]">
              <table className="case-register-table w-full table-fixed text-xs">
                <colgroup>
                  <col className="w-8" />
                  <col className="w-[11%]" />
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[7%]" />
                  <col className="w-[7%]" />
                  <col className="w-[6%]" />
                  <col className="w-[9%]" />
                  <col className="w-[9%]" />
                  <col className="w-[8%]" />
                  <col className="w-[7%]" />
                </colgroup>
                <thead className="bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-2 py-1.5 text-left">
                      <input
                        type="checkbox"
                        checked={filteredRegisterReports.length > 0 && selectedRows.length === filteredRegisterReports.length}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">Case</th>
                    <th className="px-2 py-1.5 text-left font-medium">Type</th>
                    <th className="px-2 py-1.5 text-left font-medium">Reported</th>
                    <th className="px-2 py-1.5 text-left font-medium">Employee</th>
                    <th className="px-2 py-1.5 text-left font-medium">Check-in</th>
                    <th className="px-2 py-1.5 text-left font-medium">Inv.</th>
                    <th className="px-2 py-1.5 text-left font-medium">Category</th>
                    <th className="px-2 py-1.5 text-left font-medium">Sev.</th>
                    <th className="px-2 py-1.5 text-left font-medium">Status</th>
                    <th className="px-2 py-1.5 text-left font-medium">Assigned</th>
                    <th className="px-2 py-1.5 text-left font-medium">Updated</th>
                    <th className="px-2 py-1.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRegisterReports.map((report) => {
                    const assignee = report.assignedTo ? users.find((user) => user.id === report.assignedTo) : null;
                    const reporter = report.createdByUserId ? users.find((u) => u.id === report.createdByUserId) : null;
                    const inv = report.investigationId ? investigations.find((i) => i.id === report.investigationId) : undefined;
                    const linkedPromptResponse = promptResponseForReport(report, responses);
                    return (
                      <tr
                        key={report.id}
                        className="border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)] cursor-pointer"
                        onClick={() => onNavigate('report-detail', { id: report.id })}
                      >
                        <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedRows.includes(report.id)} onChange={() => toggleRow(report.id)} />
                        </td>
                        <td className="px-2 py-1.5 min-w-0">
                          <p className="font-medium text-[var(--color-text-primary)] truncate" title={report.summary}>
                            {formatCaseReference(report)}
                          </p>
                        </td>
                        <td className="px-2 py-1.5 text-[var(--color-text-secondary)] truncate" title={CASE_TYPE_LABELS[inferCaseType(report.category, report.caseType)]}>
                          {getCaseTypeShortLabel(inferCaseType(report.category, report.caseType))}
                        </td>
                        <td className="px-2 py-1.5 text-[var(--color-text-secondary)] whitespace-nowrap">{formatDate(report.createdAt)}</td>
                        <td className="px-2 py-1.5 text-[var(--color-text-secondary)] min-w-0">
                          {report.isAnonymous ? (
                            'Anonymous'
                          ) : reporter ? (
                            <button
                              type="button"
                              className="text-[var(--mismo-blue)] hover:underline truncate block max-w-full text-left"
                              title={`${reporter.firstName} ${reporter.lastName}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('employee-detail', { id: reporter.id });
                              }}
                            >
                              {reporter.firstName} {reporter.lastName}
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-[var(--color-text-secondary)] min-w-0">
                          <p className="truncate" title={linkedPromptResponse ? `${answerLabel(linkedPromptResponse.answer)} · ${formatDate(linkedPromptResponse.submittedAt)} · Form ${isIncidentIntakeComplete(report) ? 'complete' : 'pending'}` : `Form ${isIncidentIntakeComplete(report) ? 'complete' : 'pending'}`}>
                            {linkedPromptResponse ? (
                              <>
                                <button
                                  type="button"
                                  className="text-[var(--mismo-blue)] hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigate('prompt-response-detail', { id: linkedPromptResponse.id, type: linkedPromptResponse.answer });
                                  }}
                                >
                                  {answerLabel(linkedPromptResponse.answer)}
                                </button>
                                {' · '}
                                {formatDate(linkedPromptResponse.submittedAt)}
                              </>
                            ) : (
                              '-'
                            )}
                            {' · '}
                            <span className={isIncidentIntakeComplete(report) ? 'text-emerald-700' : 'text-amber-700'}>
                              {isIncidentIntakeComplete(report) ? 'Complete' : 'Pending'}
                            </span>
                          </p>
                        </td>
                        <td className="px-2 py-1.5 text-[var(--color-text-secondary)] min-w-0">
                          {inv ? (
                            <button
                              type="button"
                              className="text-left text-[var(--mismo-blue)] hover:underline truncate block max-w-full"
                              title={investigationWorkflowLabel(getEffectiveInvestigationPhase(inv))}
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('investigation-detail', { id: inv.id });
                              }}
                            >
                              {investigationWorkflowLabel(getEffectiveInvestigationPhase(inv))}
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-2 py-1.5 truncate" title={getCategoryLabel(report.category)}>
                          {getCategoryLabel(report.category)}
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`case-register-chip ${getSeverityColor(report.severity)}`}>{report.severity}</span>
                        </td>
                        <td className="px-2 py-1.5 min-w-0">
                          <span className={`case-register-chip truncate block max-w-full ${getStatusColor(report.status)}`} title={getReportStatusLabel(report.status)}>
                            {getReportStatusShortLabel(report.status)}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 min-w-0 truncate" title={assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned'}>
                          {assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned'}
                        </td>
                        <td className="px-2 py-1.5 text-[var(--color-text-secondary)] whitespace-nowrap">{formatRelativeTime(report.updatedAt)}</td>
                        <td className="px-2 py-1.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Case actions">
                                <Icons.more className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onNavigate('report-detail', { id: report.id })}>
                                Open case
                              </DropdownMenuItem>
                                {!report.assignedTo && (
                                  <DropdownMenuItem onClick={() => { assignReport(report.id, dataStore.currentUser.id); toast.success('Assigned to you.'); }}>
                                    Assign
                                  </DropdownMenuItem>
                                )}
                                {report.status === 'NEW' && (
                                  <DropdownMenuItem onClick={() => { updateReportStatus(report.id, 'TRIAGED'); toast.success(MARK_INITIAL_REVIEW_TOAST); }}>
                                    {MARK_INITIAL_REVIEW_ACTION}
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
          <CardContent className="p-0 overflow-x-auto">
            {promptRows.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2 text-left">Query #</th>
                    <th className="px-3 py-2 text-left">Employee</th>
                    <th className="px-3 py-2 text-left">Prompt</th>
                    <th className="px-3 py-2 text-left">Submitted</th>
                    <th className="px-3 py-2 text-left">Modified</th>
                    <th className="px-3 py-2 text-left">Answer</th>
                    <th className="px-3 py-2 text-left">Review</th>
                    <th className="px-3 py-2 text-left">Linked case</th>
                    <th className="px-3 py-2 text-left">Investigation</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promptRows.map((row) => {
                    const linkedCase = linkedReportForPromptRow(row, reports);
                    const linkedInv = linkedCase ? findInvestigationForReport(linkedCase, investigations) : undefined;
                    const openRow = () => {
                      if (row.answer === 'UNANSWERED') {
                        if (row.userId) openEmployeeRegister(row.userId);
                        return;
                      }
                      onNavigate('prompt-response-detail', { id: row.id, type: row.answer });
                    };
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)] cursor-pointer"
                        onClick={openRow}
                      >
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{row.deliveryId.slice(-8).toUpperCase()}</td>
                        <td className="px-3 py-2">
                          {row.userId ? (
                            <button
                              type="button"
                              className="text-[var(--mismo-blue)] hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEmployeeRegister(row.userId!);
                              }}
                            >
                              {row.userName}
                            </button>
                          ) : (
                            row.userName
                          )}
                        </td>
                        <td className="px-3 py-2 max-w-[180px]">
                          <p className="font-medium truncate">{row.promptTitle}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{row.promptType}</p>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.date)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatRelativeTime(row.modified)}</td>
                        <td className="px-3 py-2">
                          <Badge
                            className={
                              row.answer === 'HAS_ISSUE'
                                ? 'status-chip status-chip--warn'
                                : row.answer === 'NO_ISSUE'
                                  ? 'status-chip status-chip--success'
                                  : 'status-chip'
                            }
                          >
                            {answerLabel(row.answer)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {row.answer === 'UNANSWERED' ? 'Awaiting response' : row.needsReview ? 'Needs review' : 'Reviewed'}
                        </td>
                        <td className="px-3 py-2">
                          {linkedCase ? (
                            <button
                              type="button"
                              className="text-[var(--mismo-blue)] hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('report-detail', { id: linkedCase.id });
                              }}
                            >
                              {formatCaseReference(linkedCase)}
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {linkedInv ? (
                            <button
                              type="button"
                              className="text-[var(--mismo-blue)] hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('investigation-detail', { id: linkedInv.id, tab: 'page-1' });
                              }}
                            >
                              {getInvestigationDisplayId(linkedInv)}
                            </button>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={openRow}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="p-6 text-sm text-[var(--mismo-text-secondary)]">No check-ins match the current filters.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
