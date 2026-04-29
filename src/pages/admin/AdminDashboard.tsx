import { useEffect, useMemo, useRef, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { Icons } from '@/lib/icons';

function useCountUp(target: number, durationMs = 1000, decimals = 0) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    startRef.current = null;
    const tick = (now: number) => {
      if (startRef.current == null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - (1 - t) ** 2.5;
      const current = target * eased;
      setValue(decimals > 0 ? Math.round(current * 10 ** decimals) / 10 ** decimals : Math.round(current));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs, decimals]);
  return value;
}

interface AdminDashboardProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

type ActivityWindow = '24H' | '7D' | '30D';

function formatUtcTimestamp(date: Date): string {
  const datePart = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  const timePart = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date);
  return `${datePart} | ${timePart} UTC`;
}

export function AdminDashboard({ dataStore, onNavigate }: AdminDashboardProps) {
  const nowRef = useRef(new Date());
  const [activityWindow, setActivityWindow] = useState<ActivityWindow>('7D');
  const [isLoadingActivity] = useState(false);

  const { users, reports, policies, policyAcknowledgements, investigations, responses, deliveries, activities } = dataStore;

  const computed = useMemo(() => {
    const activeEmployees = users.filter((u) => u.role === 'EMPLOYEE' && u.status === 'active');
    const requiredPolicies = policies.filter((p) => p.status === 'PUBLISHED' && p.acknowledgmentRequired);
    const totalRequiredAcks = activeEmployees.length * requiredPolicies.length;
    const pendingAcks = Math.max(0, totalRequiredAcks - policyAcknowledgements.length);

    const openInvestigations = investigations.filter((inv) => inv.status === 'OPEN');
    const memoResponses = reports.filter((report) => report.status === 'NEEDS_INFO');
    const yesPromptResponsesCount = responses.filter((r) => r.answer === 'HAS_ISSUE').length;
    const activePublishedMemos = policies.filter((p) => p.status === 'PUBLISHED').length;

    const startOfToday = new Date(nowRef.current.getFullYear(), nowRef.current.getMonth(), nowRef.current.getDate());
    const upcomingMemoDeadlines = policies
      .filter((p) => p.status === 'PUBLISHED' && p.completionDueDate)
      .filter((p) => {
        const d = p.completionDueDate instanceof Date ? p.completionDueDate : new Date(String(p.completionDueDate));
        return d.getTime() >= startOfToday.getTime();
      })
      .sort((a, b) => {
        const da = a.completionDueDate instanceof Date ? a.completionDueDate : new Date(String(a.completionDueDate));
        const db = b.completionDueDate instanceof Date ? b.completionDueDate : new Date(String(b.completionDueDate));
        return da.getTime() - db.getTime();
      })
      .slice(0, 6)
      .map((p) => ({
        id: p.id,
        title: p.title,
        dueAt: (p.completionDueDate instanceof Date ? p.completionDueDate : new Date(String(p.completionDueDate))) as Date,
      }));

    const atRiskEmployees = activeEmployees.filter((employee) => {
      const employeeDeliveries30d = deliveries.filter(
        (delivery) => delivery.userId === employee.id && nowRef.current.getTime() - delivery.deliveredAt.getTime() <= 30 * 24 * 60 * 60 * 1000
      );
      const completed30d = employeeDeliveries30d.filter((delivery) => delivery.status === 'COMPLETED').length;
      const responseRate30d = employeeDeliveries30d.length ? completed30d / employeeDeliveries30d.length : 0;
      const lastResponse = responses
        .filter((response) => response.userId === employee.id)
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())[0];
      return !lastResponse || responseRate30d < dataStore.orgSettings.thresholds.atRiskMinResponseRate;
    });

    // Analytics index: weighted composite 0–1 → displayed 0–100 (e.g. 29.6)
    // 28% policy acknowledgment rate, 26% prompt completion rate, 30% investigation closure rate, 16% inverse of exposure (open memos + open investigations, capped)
    const policyRate = totalRequiredAcks > 0 ? 1 - pendingAcks / totalRequiredAcks : 1;
    const promptRate = deliveries.length > 0 ? responses.length / deliveries.length : 1;
    const investigationRate = investigations.length > 0 ? investigations.filter((i) => i.status === 'CLOSED').length / investigations.length : 1;
    const riskExposurePenalty = Math.min(1, (memoResponses.length + openInvestigations.length) / 24);
    const analyticsIndex = policyRate * 0.28 + promptRate * 0.26 + investigationRate * 0.3 + (1 - riskExposurePenalty) * 0.16;

    const actionRequiredCount = openInvestigations.length + memoResponses.length + pendingAcks + yesPromptResponsesCount;

    const windowMs = activityWindow === '24H' ? 24 * 60 * 60 * 1000 : activityWindow === '7D' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
    const recentActivity = activities
      .filter((activity) => nowRef.current.getTime() - activity.createdAt.getTime() <= windowMs)
      .slice(0, 6);

    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000 - 1);
    const hasIssueResponsesToday = responses.filter(
      (r) => r.answer === 'HAS_ISSUE' && r.submittedAt >= startOfToday && r.submittedAt <= endOfToday
    ).length;
    const pendingPromptResponsesToday = deliveries.filter(
      (d) => d.status === 'PENDING' && d.dueAt && d.dueAt <= endOfToday
    ).length;

    return {
      pendingAcks,
      openInvestigations,
      memoResponses,
      atRiskEmployees,
      analyticsIndex,
      actionRequiredCount,
      recentActivity,
      hasIssueResponsesToday,
      pendingPromptResponsesToday,
      yesPromptResponsesCount,
      activePublishedMemos,
      upcomingMemoDeadlines,
    };
  }, [activities, activityWindow, dataStore.orgSettings.thresholds.atRiskMinResponseRate, deliveries, investigations, policies, policyAcknowledgements, reports, responses, users]);

  const atRiskEmails = computed.atRiskEmployees.map((user) => user.email).filter(Boolean);

  const countAction = useCountUp(computed.actionRequiredCount, 1000, 0);
  const countAnalyticsIndex = useCountUp(computed.analyticsIndex * 100, 1000, 1);
  const countInvestigations = useCountUp(computed.openInvestigations.length, 900, 0);
  const countYesResponses = useCountUp(computed.yesPromptResponsesCount, 900, 0);
  const countActivePublishedMemos = useCountUp(computed.activePublishedMemos, 900, 0);
  const countMemoNeedInfo = useCountUp(computed.memoResponses.length, 900, 0);
  const countAcks = useCountUp(computed.pendingAcks, 900, 0);
  const countAtRisk = useCountUp(computed.atRiskEmployees.length, 900, 0);

  const exportAtRiskEmails = () => {
    const csv = ['email', ...atRiskEmails].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'at-risk-emails.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyAtRiskEmails = async () => {
    if (atRiskEmails.length === 0) return;
    await navigator.clipboard.writeText(atRiskEmails.join('; '));
  };

  return (
    <div className="space-y-6">
      <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-6 py-5 rounded-[var(--radius-medium)]">
        <h1 className="font-command text-[28px] sm:text-[32px] font-medium text-[var(--color-primary-900)]">Risk Command Center</h1>
        <p className="mt-1 text-base font-command text-[var(--color-text-secondary)]">
          We provide structured oversight across investigations, company memo adherence, and workforce exposure.
        </p>
        <p className="mt-2 text-sm font-command text-[var(--color-text-muted)]">Compliance made human. Everything you enter matters.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="enterprise-interactive font-command border-[var(--color-primary-900)] text-[var(--color-primary-900)]"
            onClick={() => onNavigate('users')}
          >
            Manage employees
          </Button>
          <Button variant="outline" size="sm" className="enterprise-interactive font-command" onClick={() => onNavigate('users', { import: 'csv' })}>
            Bulk import employees
          </Button>
          <Button variant="outline" size="sm" className="enterprise-interactive font-command" onClick={() => onNavigate('policies')}>
            Manage memos
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
        <Card className="mismo-card">
          <CardContent className="p-6 flex flex-row items-stretch gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] uppercase tracking-[0.08em] font-command text-[var(--color-text-secondary)]">Action Required</p>
              {computed.actionRequiredCount === 0 && computed.hasIssueResponsesToday === 0 && computed.pendingPromptResponsesToday === 0 ? (
                <p className="mt-2 text-sm font-command text-[var(--color-text-secondary)]">All systems operating within compliance thresholds.</p>
              ) : (
                <>
                  {(computed.hasIssueResponsesToday > 0 || computed.pendingPromptResponsesToday > 0) && (
                    <div className="mt-3 space-y-1 text-sm font-command">
                      {computed.hasIssueResponsesToday > 0 && (
                        <p className="text-[var(--color-alert-600)] font-medium">
                          • {computed.hasIssueResponsesToday} staff chose Yes on a check-in today; review in Case register & check-ins
                        </p>
                      )}
                      {computed.pendingPromptResponsesToday > 0 && (
                        <p className="text-[var(--color-alert-600)] font-medium">• {computed.pendingPromptResponsesToday} daily prompt(s) not yet answered; send reminders</p>
                      )}
                    </div>
                  )}
                  <div className="mt-3 space-y-1 text-sm font-command text-[var(--color-text-secondary)]">
                    <p>
                      • <span className="text-[var(--color-alert-600)] font-medium">{countYesResponses} Yes</span> prompt responses (review first)
                    </p>
                    <p>• {countInvestigations} Open investigations</p>
                    <p>• {countMemoNeedInfo} Incident reports awaiting clarification (NEEDS_INFO)</p>
                    <p>• {countAcks} Memo tasks pending</p>
                  </div>
                </>
              )}
              <Button
                aria-label="Open action register"
                className="mt-4 bg-[var(--color-emerald-600)] hover:bg-[var(--color-emerald-500)] text-white enterprise-interactive font-command"
                onClick={() => onNavigate('prompt-responses', { status: 'NEW,TRIAGED,ASSIGNED,IN_REVIEW,NEEDS_INFO' })}
              >
                Open Action Register →
              </Button>
            </div>
            {computed.actionRequiredCount > 0 && (
              <div className="flex items-center justify-center flex-shrink-0 pl-4 border-l border-[var(--color-border-200)]">
                <span className="font-command text-6xl sm:text-7xl font-medium text-[var(--color-alert-600)] tabular-nums">{countAction}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mismo-card">
          <CardContent className="p-6 space-y-3">
            <p className="text-[12px] uppercase tracking-[0.08em] font-command text-[var(--color-text-secondary)]">Analytics (same as sidebar)</p>
            <p className="font-command text-4xl font-medium text-[var(--color-primary-900)] tabular-nums">{countAnalyticsIndex.toFixed(1)}</p>
            <p className="text-sm font-command text-[var(--color-text-secondary)]">
              Snapshot index for this screen. Open <span className="font-medium text-[var(--color-text-primary)]">Analytics</span> for full
              reporting, exports, and risk posture views.
            </p>
            <p className="text-sm font-command text-[var(--color-text-secondary)]">Change from prior window: <span className="text-[var(--color-accent-gold)]">+1.6</span></p>
            <p className="text-xs font-command text-[var(--color-text-muted)]">Last updated: {formatUtcTimestamp(nowRef.current)}</p>
            <Button
              aria-label="View Analytics"
              variant="outline"
              className="w-full sm:w-auto border-[var(--color-primary-900)] text-[var(--color-primary-900)] enterprise-interactive font-command"
              onClick={() => onNavigate('analytics')}
            >
              View Analytics →
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="mismo-card">
          <CardContent className="p-5 space-y-2 text-center flex flex-col items-center">
            <p className="text-[12px] uppercase tracking-[0.08em] font-command text-[var(--color-text-secondary)]">Yes responses</p>
            <p className="font-command text-4xl font-medium tabular-nums text-[var(--color-alert-600)]">{countYesResponses}</p>
            <p className="text-xs font-command text-[var(--color-text-secondary)] max-w-[220px]">
              Check-in answers where staff chose Yes; review first (newest first in the register).
            </p>
            <Button
              variant="outline"
              className="border-[var(--color-alert-600)] text-[var(--color-alert-600)] enterprise-interactive font-command"
              onClick={() => onNavigate('prompt-responses', { answer: 'HAS_ISSUE', rangePreset: 'ALL' })}
            >
              Review Yes responses →
            </Button>
          </CardContent>
        </Card>
        <Card className="mismo-card">
          <CardContent className="p-5 space-y-2 text-center flex flex-col items-center">
            <p className="text-[12px] uppercase tracking-[0.08em] font-command text-[var(--color-text-secondary)]">Open investigations</p>
            <p className="font-command text-4xl font-medium tabular-nums">{countInvestigations}</p>
            <p className="text-xs font-command text-[var(--color-text-secondary)] max-w-[220px]">In progress on the investigations register.</p>
            <Button variant="outline" className="border-[var(--color-primary-900)] text-[var(--color-primary-900)] enterprise-interactive font-command" onClick={() => onNavigate('investigations')}>
              View investigations →
            </Button>
          </CardContent>
        </Card>
        <Card className="mismo-card">
          <CardContent className="p-5 space-y-2 text-center flex flex-col items-center">
            <p className="text-[12px] uppercase tracking-[0.08em] font-command text-[var(--color-text-secondary)]">Memo responses</p>
            <p className="font-command text-4xl font-medium tabular-nums">{countActivePublishedMemos}</p>
            <p className="text-sm font-command text-[var(--color-text-secondary)] tabular-nums">
              <span className="text-[var(--color-alert-600)] font-semibold">{countAcks}</span> pending tasks
            </p>
            <p className="text-xs font-command text-[var(--color-text-secondary)] max-w-[240px]">
              Published memos live today; second figure is open memo tasks (sign-offs).
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[260px]">
              <Button
                variant="outline"
                className="border-[var(--color-primary-900)] text-[var(--color-primary-900)] enterprise-interactive font-command"
                onClick={() => onNavigate('policies')}
              >
                View memos & responses →
              </Button>
              <Button variant="ghost" size="sm" className="text-[var(--color-primary-700)] font-command" onClick={() => onNavigate('policies')}>
                Manage memos
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="mismo-card">
          <CardContent className="p-5 space-y-2 text-center flex flex-col items-center">
            <p className="text-[12px] uppercase tracking-[0.08em] font-command text-[var(--color-text-secondary)]">At-Risk Employees</p>
            <p className="font-command text-4xl font-medium tabular-nums">{countAtRisk}</p>
            <Button variant="outline" className="border-[var(--color-primary-900)] text-[var(--color-primary-900)] enterprise-interactive font-command" onClick={() => onNavigate('users', { atRisk: 'true' })}>
              View Employees
            </Button>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button variant="outline" size="sm" className="enterprise-interactive" onClick={exportAtRiskEmails}>
                Export Email List
              </Button>
              <Button variant="outline" size="sm" className="enterprise-interactive" onClick={() => void copyAtRiskEmails()}>
                Copy Emails
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="mismo-card">
            <CardContent className="p-0">
              <div className="px-5 py-4 border-b border-[var(--color-border-200)] flex items-center justify-between">
                <div>
                  <h2 className="font-command text-2xl font-bold text-[var(--color-primary-900)]">Recent Activity</h2>
                  <p className="text-sm text-[var(--color-text-secondary)]">Audit-ready timeline of key actions.</p>
                </div>
                <select
                  aria-label="Filter recent activity by date window"
                  className="border border-[var(--color-border-200)] bg-white px-2 py-1 text-xs"
                  value={activityWindow}
                  onChange={(event) => setActivityWindow(event.target.value as ActivityWindow)}
                >
                  <option value="24H">24H</option>
                  <option value="7D">7D</option>
                  <option value="30D">30D</option>
                </select>
              </div>
              {isLoadingActivity ? (
                <div className="p-5 space-y-2" aria-label="Loading activity rows">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="h-8 bg-[var(--color-surface-200)] animate-pulse rounded-[var(--radius-small)]" />
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border-200)]">
                  {computed.recentActivity.map((activity) => (
                    <button
                      key={activity.id}
                      type="button"
                      aria-label={`View activity event ${activity.type}`}
                      className="w-full text-left px-5 py-3 enterprise-interactive"
                      onClick={() => onNavigate('activity', { eventType: activity.type })}
                    >
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">{activity.type.replaceAll('_', ' ')}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{formatRelativeTime(activity.createdAt)}</p>
                    </button>
                  ))}
                  {computed.recentActivity.length === 0 && (
                    <p className="px-5 py-6 text-sm text-[var(--color-text-secondary)]">No activity in this date window.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        <Card className="mismo-card">
            <CardContent className="p-5">
              <h3 className="font-command text-xl font-bold text-[var(--color-primary-900)]">Memo completion deadlines</h3>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Only published memos with a completion due date appear here (end of sign-off window).
              </p>
              <div className="mt-3 space-y-2">
                {computed.upcomingMemoDeadlines.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full text-left p-3 border border-[var(--color-border-200)] rounded-[var(--radius-small)] enterprise-interactive"
                    onClick={() => onNavigate('policy-detail', { id: item.id })}
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">Complete by {formatDate(item.dueAt)}</p>
                  </button>
                ))}
                {computed.upcomingMemoDeadlines.length === 0 && (
                  <p className="text-sm text-[var(--color-text-secondary)]">No memo deadlines with end dates in the current window.</p>
                )}
              </div>
            </CardContent>
          </Card>
      </div>

      <div className="border-t border-[var(--color-border-200)] pt-3 flex items-center gap-6 text-sm text-[var(--color-text-secondary)]">
        <div className="flex items-center gap-2"><Icons.database className="h-4 w-4" /> Database: Healthy</div>
        <div className="flex items-center gap-2"><Icons.mail className="h-4 w-4" /> Email Service: Ready</div>
      </div>
    </div>
  );
}
