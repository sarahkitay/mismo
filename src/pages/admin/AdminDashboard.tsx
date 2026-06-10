import { useMemo } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { toast } from 'sonner';
import { Icons } from '@/lib/icons';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface AdminDashboardProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

const CHART_COLORS = {
  navy: '#1e3a5f',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  gray: '#94a3b8',
};

function ActionLine({
  label,
  count,
  onClick,
  urgent,
}: {
  label: string;
  count: number;
  onClick: () => void;
  urgent?: boolean;
}) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center justify-between gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-[var(--color-surface-200)] transition-colors"
    >
      <span className={`text-sm ${urgent ? 'text-[var(--color-alert-600)] font-medium' : 'text-[var(--color-text-secondary)]'}`}>
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${urgent ? 'text-[var(--color-alert-600)]' : ''}`}>{count}</span>
    </button>
  );
}

export function AdminDashboard({ dataStore, onNavigate }: AdminDashboardProps) {
  const dc = dataStore.dashboardCounts;
  const { policies, policyAcknowledgements, responses, deliveries, investigations, activities, users, reports, prompts } = dataStore;

  const recentCheckInQueries = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const rows = [
      ...responses
        .filter((r) => r.submittedAt >= startOfToday)
        .map((r) => ({
          id: r.id,
          kind: 'response' as const,
          userId: r.userId,
          answer: r.answer,
          date: r.submittedAt,
          promptTitle: prompts.find((p) => p.id === r.promptId)?.title ?? 'Check-in',
        })),
      ...deliveries
        .filter((d) => d.status === 'PENDING' && d.deliveredAt >= startOfToday)
        .map((d) => ({
          id: d.id,
          kind: 'pending' as const,
          userId: d.userId,
          answer: 'UNANSWERED' as const,
          date: d.deliveredAt,
          promptTitle: prompts.find((p) => p.id === d.promptId)?.title ?? 'Check-in',
        })),
    ];
    return rows.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  }, [responses, deliveries, prompts]);

  const chartData = useMemo(() => {
    const yesCount = responses.filter((r) => r.answer === 'HAS_ISSUE').length;
    const noCount = responses.filter((r) => r.answer === 'NO_ISSUE').length;
    const unanswered = deliveries.filter((d) => d.status === 'PENDING').length;
    const needsClarification = dc.reportsNeedingClarification;

    const activeEmployees = users.filter((u) => u.role === 'EMPLOYEE' && u.status === 'active');
    const requiredMemos = policies.filter((p) => p.status === 'PUBLISHED' && p.acknowledgmentRequired);
    let memoUnderstood = 0;
    let memoNeedsClar = 0;
    let memoUnanswered = 0;
    for (const p of requiredMemos) {
      for (const emp of activeEmployees) {
        const ack = policyAcknowledgements.find((a) => a.policyId === p.id && a.userId === emp.id);
        if (!ack) memoUnanswered += 1;
        else if (ack.outcome === 'REQUEST_CLARIFICATION') memoNeedsClar += 1;
        else memoUnderstood += 1;
      }
    }

    const invOpen = investigations.filter((i) => i.status === 'OPEN' && i.workflowPhase === 'QUEUED').length;
    const invProgress = investigations.filter((i) => i.status === 'OPEN' && i.workflowPhase === 'IN_PROGRESS').length;
    const invComplete = investigations.filter((i) => i.status === 'CLOSED' || i.workflowPhase === 'AWAITING_OUTCOME_ACK').length;

    return {
      promptResponses: [
        { name: 'Yes', value: yesCount, fill: CHART_COLORS.red },
        { name: 'No', value: noCount, fill: CHART_COLORS.green },
        { name: 'Unanswered', value: unanswered, fill: CHART_COLORS.amber },
        { name: 'Needs clarification', value: needsClarification, fill: CHART_COLORS.navy },
      ],
      memoStatus: [
        { name: 'Read & understood', value: memoUnderstood, fill: CHART_COLORS.green },
        { name: 'Needs clarification', value: memoNeedsClar, fill: CHART_COLORS.amber },
        { name: 'Unanswered', value: memoUnanswered, fill: CHART_COLORS.red },
      ],
      investigations: [
        { name: 'Open (queued)', value: invOpen, fill: CHART_COLORS.amber },
        { name: 'In progress', value: invProgress, fill: CHART_COLORS.navy },
        { name: 'Complete / closed', value: invComplete, fill: CHART_COLORS.green },
      ],
    };
  }, [responses, deliveries, dc.reportsNeedingClarification, policies, policyAcknowledgements, users, investigations]);

  const recentActivity = activities.slice(0, 6);
  const analyticsScore = useMemo(() => {
    const activeEmployees = users.filter((u) => u.role === 'EMPLOYEE' && u.status === 'active').length;
    const required = policies.filter((p) => p.status === 'PUBLISHED' && p.acknowledgmentRequired).length * activeEmployees;
    const policyRate = required > 0 ? policyAcknowledgements.length / required : 1;
    const promptRate = deliveries.length ? responses.length / deliveries.length : 1;
    const invRate = investigations.length ? investigations.filter((i) => i.status === 'CLOSED').length / investigations.length : 1;
    return (policyRate * 0.28 + promptRate * 0.26 + invRate * 0.3 + 0.16) * 100;
  }, [users, policies, policyAcknowledgements, deliveries, responses, investigations]);

  const totalYesResponses = responses.filter((r) => r.answer === 'HAS_ISSUE').length;
  const resolvedReports = reports.filter((r) => ['RESOLVED', 'CLOSED'].includes(r.status));
  const avgResolutionDays = resolvedReports.length
    ? resolvedReports.reduce((sum, r) => sum + (r.updatedAt.getTime() - r.createdAt.getTime()) / (1000 * 60 * 60 * 24), 0) /
      resolvedReports.length
    : 0;
  const activeMemosCount = policies.filter((p) => p.status === 'PUBLISHED').length;

  const upcomingMemoDeadlines = policies
    .filter((p) => p.status === 'PUBLISHED' && p.completionDueDate)
    .sort((a, b) => (a.completionDueDate!.getTime() - b.completionDueDate!.getTime()))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-6 py-5 rounded-[var(--radius-medium)]">
        <h1 className="font-command text-[28px] sm:text-[32px] font-medium text-[var(--color-primary-900)]">Risk Command Center</h1>
        <p className="mt-1 text-base text-[var(--color-text-secondary)]">
          Employee relations and compliance command center. Every count below opens the underlying filtered register.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onNavigate('case-register', { view: 'register', action: 'pending' })}>
            Open action register
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('users')}>
            Manage employees
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('users', { import: 'csv' })}>
            Bulk import employees
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('policies')}>
            Manage memos
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('prompts')}>
            Manage prompts
          </Button>
          <Button variant="outline" size="sm" onClick={() => onNavigate('analytics')}>
            View analytics
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-4">
        <Card className="mismo-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Action required</p>
                {dc.actionRequiredTotal === 0 ? (
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)]">All systems operating within compliance thresholds.</p>
                ) : (
                  <div className="mt-3 space-y-0.5">
                    <ActionLine
                      label="Daily prompts not answered"
                      count={dc.unansweredPromptDeliveries}
                      urgent
                      onClick={() => onNavigate('prompt-responses', { bucket: 'UNANSWERED', view: 'prompts' })}
                    />
                    <ActionLine
                      label="Yes responses needing review"
                      count={dc.yesResponsesNeedingReview}
                      urgent
                      onClick={() => onNavigate('prompt-responses', { answer: 'HAS_ISSUE', needs_review: '1', view: 'prompts' })}
                    />
                    <ActionLine
                      label="Open investigations"
                      count={dc.activeInvestigations}
                      onClick={() => onNavigate('investigations', { status: 'OPEN' })}
                    />
                    <ActionLine
                      label="Incident reports awaiting clarification"
                      count={dc.reportsNeedingClarification}
                      onClick={() => onNavigate('case-register', { view: 'register', register: '1', needs_info: '1' })}
                    />
                    <ActionLine
                      label="Memo tasks pending acknowledgement"
                      count={dc.memoAcknowledgementsPending}
                      onClick={() => onNavigate('policies', { memoQueue: 'pending_ack' })}
                    />
                    <ActionLine
                      label="Memos needing clarification"
                      count={dc.memosNeedingClarification}
                      onClick={() => onNavigate('policies', { memoQueue: 'clarification' })}
                    />
                  </div>
                )}
                <Button
                  className="mt-4 bg-[var(--color-primary-900)] hover:bg-[var(--color-primary-700)] text-white"
                  onClick={() => onNavigate('case-register', { view: 'register', register: '1' })}
                >
                  Open action register →
                </Button>
              </div>
              {dc.actionRequiredTotal > 0 && (
                <button
                  type="button"
                  onClick={() => onNavigate('case-register', { view: 'register', register: '1' })}
                  className="flex items-center justify-center flex-shrink-0 pl-4 border-l border-[var(--color-border-200)] hover:opacity-80"
                  aria-label="View all action required items"
                >
                  <span className="font-command text-6xl sm:text-7xl font-medium text-[var(--color-alert-600)] tabular-nums">
                    {dc.actionRequiredTotal}
                  </span>
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mismo-card cursor-pointer hover:border-[var(--color-primary-700)] transition-colors" onClick={() => onNavigate('analytics')}>
          <CardContent className="p-6 space-y-3">
            <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Analytics index</p>
            <p className="font-command text-4xl font-medium text-[var(--color-primary-900)] tabular-nums">{analyticsScore.toFixed(1)}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Weighted compliance snapshot. Open Analytics for full reporting, exports, and trend views.
            </p>
            <Button variant="outline" className="border-[var(--color-primary-900)] text-[var(--color-primary-900)]" onClick={() => onNavigate('analytics')}>
              View analytics →
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {[
          {
            label: 'Total yes answers',
            count: totalYesResponses,
            helper: 'All-time check-in answers where staff chose Yes.',
            action: 'Review yes responses',
            onClick: () => onNavigate('prompt-responses', { answer: 'HAS_ISSUE', view: 'prompts', channel: 'incident', rangePreset: 'ALL' }),
            accent: 'text-[var(--color-alert-600)]',
          },
          {
            label: 'Open investigations',
            count: dc.activeInvestigations,
            helper: 'Includes Yes responses under active review and formal investigations.',
            action: 'View investigations',
            onClick: () => onNavigate('investigations', { status: 'OPEN' }),
          },
          {
            label: 'Resolved cases',
            count: resolvedReports.length,
            helper: 'Reports marked resolved or closed.',
            action: 'View resolved',
            onClick: () => onNavigate('case-register', { view: 'register', register: '1', status: 'RESOLVED,CLOSED' }),
          },
          {
            label: 'Avg resolution (days)',
            count: `${avgResolutionDays.toFixed(1)}`,
            helper: 'Days from open to resolved/closed (resolved cases only).',
            action: 'Open analytics',
            onClick: () => onNavigate('analytics'),
          },
          {
            label: 'Active memos',
            count: activeMemosCount,
            helper: 'Published memos currently live in the employee portal.',
            action: 'Manage memos',
            onClick: () => onNavigate('policies'),
          },
          {
            label: 'At-risk employees',
            count: dc.atRiskEmployees,
            helper: 'Low engagement or overdue check-ins in the last 30 days.',
            action: 'View employees',
            onClick: () => onNavigate('users', { atRisk: 'true' }),
          },
        ].map((card) => (
          <Card key={card.label} className="mismo-card h-full hover:border-[var(--color-primary-700)] transition-colors">
            <CardContent className="p-5 flex h-full flex-col">
              <p className="text-[12px] uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{card.label}</p>
              <p className={`font-command text-4xl font-medium tabular-nums mt-2 ${'accent' in card ? card.accent ?? '' : ''}`}>{card.count}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-2 flex-1">{card.helper}</p>
              <div className="mt-4 flex flex-col gap-2">
                <Button variant="outline" className="w-full border-[var(--color-primary-900)] text-[var(--color-primary-900)]" onClick={card.onClick}>
                  {card.action} →
                </Button>
                {card.label === 'At-risk employees' && dc.atRiskEmployees > 0 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        const emails = users
                          .filter((u) => u.role === 'EMPLOYEE' && dataStore.getEmployeeEngagement(u.id)?.isAtRisk)
                          .map((u) => u.email)
                          .join(', ');
                        void navigator.clipboard.writeText(emails);
                        toast.success('At-risk employee emails copied.');
                      }}
                    >
                      Copy emails
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-[var(--color-border-200)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-command text-xl font-bold text-[var(--color-primary-900)]">Today&apos;s employee check-in queries</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Incident and compliance prompts submitted today — same register HR and admin use for triage.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onNavigate('prompt-responses', { view: 'prompts', channel: 'incident' })}>
              Open check-in register →
            </Button>
          </div>
          {recentCheckInQueries.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left">Employee</th>
                    <th className="px-4 py-2 text-left">Prompt</th>
                    <th className="px-4 py-2 text-left">Time</th>
                    <th className="px-4 py-2 text-left">Answer</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCheckInQueries.map((row) => {
                    const emp = users.find((u) => u.id === row.userId);
                    const linkedCase = row.kind === 'response' ? reports.find((r) => r.sourcePromptResponseId === row.id) : undefined;
                    const openRow = () => {
                      if (row.kind === 'pending' && row.userId) {
                        onNavigate('employee-detail', { id: row.userId });
                        return;
                      }
                      if (row.kind === 'response') {
                        onNavigate('prompt-response-detail', { id: row.id, type: row.answer });
                      }
                    };
                    return (
                      <tr
                        key={`${row.kind}-${row.id}`}
                        className="border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)] cursor-pointer"
                        onClick={openRow}
                      >
                        <td className="px-4 py-2">
                          {emp ? `${emp.firstName} ${emp.lastName}` : 'Employee'}
                        </td>
                        <td className="px-4 py-2">{row.promptTitle}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{formatRelativeTime(row.date)}</td>
                        <td className="px-4 py-2">
                          {row.answer === 'HAS_ISSUE' ? 'Yes' : row.answer === 'NO_ISSUE' ? 'No' : 'Unanswered'}
                          {linkedCase ? (
                            <span className="text-[var(--color-text-muted)]">
                              {' '}
                              ·{' '}
                              <button
                                type="button"
                                className="text-[var(--mismo-blue)] hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate('report-detail', { id: linkedCase.id });
                                }}
                              >
                                {linkedCase.referenceNumber ?? linkedCase.id}
                              </button>
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" onClick={openRow}>
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-6 text-sm text-[var(--color-text-secondary)]">No check-in queries recorded yet today.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { title: 'Prompt response status', data: chartData.promptResponses, onClick: () => onNavigate('prompt-responses', { view: 'prompts' }) },
          { title: 'Memo acknowledgement status', data: chartData.memoStatus, onClick: () => onNavigate('policies') },
          { title: 'Investigation status', data: chartData.investigations, onClick: () => onNavigate('investigations') },
        ].map((chart) => (
          <Card key={chart.title} className="mismo-card">
            <CardContent className="p-4">
              <button type="button" className="text-left w-full mb-3" onClick={chart.onClick}>
                <h3 className="font-semibold text-[var(--color-primary-900)] text-sm hover:underline">{chart.title}</h3>
              </button>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart.data} layout="vertical" margin={{ left: 8, right: 8, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-200)" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="mismo-card">
          <CardContent className="p-0">
            <div className="px-5 py-4 border-b border-[var(--color-border-200)]">
              <h2 className="font-command text-xl font-bold text-[var(--color-primary-900)]">Recent activity</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">Audit-ready timeline of key actions.</p>
            </div>
            <div className="divide-y divide-[var(--color-border-200)]">
              {recentActivity.map((activity) => (
                <button
                  key={activity.id}
                  type="button"
                  className="w-full text-left px-5 py-3 hover:bg-[var(--color-surface-200)]"
                  onClick={() => onNavigate('activity', { eventType: activity.type })}
                >
                  <p className="text-sm font-medium">{activity.type.replaceAll('_', ' ')}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{formatRelativeTime(activity.createdAt)}</p>
                </button>
              ))}
              {recentActivity.length === 0 && (
                <p className="px-5 py-6 text-sm text-[var(--color-text-secondary)]">No recent activity recorded yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mismo-card">
          <CardContent className="p-5">
            <h3 className="font-command text-xl font-bold text-[var(--color-primary-900)]">Memo completion deadlines</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">Published memos with a completion due date.</p>
            <div className="mt-3 space-y-2">
              {upcomingMemoDeadlines.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left p-3 border border-[var(--color-border-200)] rounded-[var(--radius-small)] hover:bg-[var(--color-surface-200)]"
                  onClick={() => onNavigate('policy-detail', { id: item.id })}
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Complete by {formatDate(item.completionDueDate!)}</p>
                </button>
              ))}
              {upcomingMemoDeadlines.length === 0 && (
                <p className="text-sm text-[var(--color-text-secondary)]">No memo deadlines in the current window.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="border-t border-[var(--color-border-200)] pt-3 flex items-center gap-6 text-sm text-[var(--color-text-secondary)]">
        <button type="button" className="flex items-center gap-2 hover:text-[var(--color-primary-900)]" onClick={() => onNavigate('system-health')}>
          <Icons.database className="h-4 w-4" /> System health
        </button>
        <span className="flex items-center gap-2">
          <Icons.mail className="h-4 w-4" /> Email service: Ready
        </span>
      </div>
    </div>
  );
}
