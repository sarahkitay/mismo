import { useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { defaultDateRange, inDateRange, type DateRangeState } from '@/lib/dateFilters';
import { formatRelativeTime, getCategoryLabel } from '@/lib/utils';

interface ManagerDashboardProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function ManagerDashboard({ dataStore, onNavigate }: ManagerDashboardProps) {
  const { currentUser, reports, responses, users, dashboardCounts } = dataStore;
  const [searchQuery, setSearchQuery] = useState('');
  const [queueRange, setQueueRange] = useState<DateRangeState>({ ...defaultDateRange, preset: '30D' });

  const queueData = useMemo(() => {
    const unresolvedReports = reports
      .filter((report) => !['RESOLVED', 'CLOSED'].includes(report.status))
      .filter((report) => inDateRange(report.createdAt, queueRange))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const filteredReports = unresolvedReports.filter((report) => {
      if (!searchQuery.trim()) return true;
      const reporter = report.createdByUserId ? users.find((u) => u.id === report.createdByUserId) : undefined;
      const searchBlob = `${report.summary} ${report.description} ${report.category} ${report.id} ${report.peopleInvolved ?? ''} ${report.location ?? ''} ${reporter?.firstName ?? ''} ${reporter?.lastName ?? ''}`.toLowerCase();
      return searchBlob.includes(searchQuery.toLowerCase());
    });

    const issueResponses = responses.filter((response) => response.answer === 'HAS_ISSUE' && inDateRange(response.submittedAt, queueRange));
    const promptIssuesWithoutCase = issueResponses.filter(
      (response) =>
        !reports.some(
          (report) =>
            report.sourcePromptResponseId === response.id ||
            report.sourcePromptResponseId === response.promptDeliveryId
        )
    );

    return {
      unresolvedReports: filteredReports,
      promptIssuesWithoutCase,
    };
  }, [queueRange, reports, responses, searchQuery, users]);

  return (
    <div className="space-y-6">
      <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-6 py-5">
        <h1 className="mismo-heading text-3xl text-[var(--color-primary-900)]">Human Resources Dashboard</h1>
        <p className="text-[var(--color-text-secondary)] mt-1">
          {currentUser.firstName}, all report intake, handling actions, and employee response evidence are centralized here first.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="mismo-card">
          <CardContent className="p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">Open Case Intake</p>
            <p className="text-3xl font-bold">{queueData.unresolvedReports.length}</p>
            <Button className="mt-2" variant="outline" onClick={() => onNavigate('reports', { status: 'NEW,TRIAGED,ASSIGNED,IN_REVIEW,NEEDS_INFO' })}>
              Open Register
            </Button>
          </CardContent>
        </Card>
        <Card className="mismo-card">
          <CardContent className="p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">Prompt Issues Without Case</p>
            <p className="text-3xl font-bold">{queueData.promptIssuesWithoutCase.length}</p>
            <Button className="mt-2" variant="outline" onClick={() => onNavigate('prompt-responses', { answer: 'HAS_ISSUE' })}>
              Review Prompt Issues
            </Button>
          </CardContent>
        </Card>
        <Card className="mismo-card">
          <CardContent className="p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">At-Risk Employees</p>
            <p className="text-3xl font-bold">{dashboardCounts.atRiskEmployees}</p>
            <Button className="mt-2" variant="outline" onClick={() => onNavigate('users', { atRisk: 'true' })}>
              View Users
            </Button>
          </CardContent>
        </Card>
        <Card className="mismo-card">
          <CardContent className="p-4">
            <p className="text-sm text-[var(--color-text-secondary)]">Active Investigations</p>
            <p className="text-3xl font-bold">{dashboardCounts.activeInvestigations}</p>
            <Button className="mt-2" variant="outline" onClick={() => onNavigate('investigations', { status: 'OPEN' })}>
              View Investigations
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mismo-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search employee name or issue details..."
                className="w-full pl-10 pr-3 py-2 border border-[var(--color-border-200)] bg-[var(--color-surface-100)]"
              />
            </div>
            <DateRangeFilter value={queueRange} onChange={setQueueRange} />
          </div>

          <div className="border border-[var(--color-border-200)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-200)]">
                <tr>
                  <th className="text-left px-3 py-2">Case</th>
                  <th className="text-left px-3 py-2">Employee</th>
                  <th className="text-left px-3 py-2">Category</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Last Update</th>
                  <th className="text-right px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {queueData.unresolvedReports.slice(0, 12).map((report) => {
                  const employee = report.createdByUserId ? users.find((u) => u.id === report.createdByUserId) : null;
                  return (
                    <tr key={report.id} className="border-t border-[var(--color-border-200)]">
                      <td className="px-3 py-2">
                        <p className="font-medium">#{report.id.replace('report-', '').toUpperCase()}</p>
                        <p className="text-[var(--color-text-secondary)]">{report.summary}</p>
                      </td>
                      <td className="px-3 py-2">{employee ? `${employee.firstName} ${employee.lastName}` : 'Anonymous / Unnamed'}</td>
                      <td className="px-3 py-2">{getCategoryLabel(report.category)}</td>
                      <td className="px-3 py-2">{report.status}</td>
                      <td className="px-3 py-2 text-[var(--color-text-secondary)]">{formatRelativeTime(report.updatedAt)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="outline" size="sm" onClick={() => onNavigate('report-detail', { id: report.id })}>
                          Open Handling View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
