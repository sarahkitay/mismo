import { useEffect, useRef, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPercent } from '@/lib/utils';
import { mockDepartments } from '@/data/mockData';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { defaultDateRange, inDateRange, type DateRangeState } from '@/lib/dateFilters';

interface AdminAnalyticsProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function AdminAnalytics({ dataStore, onNavigate }: AdminAnalyticsProps) {
  const { reports, deliveries, responses, policies, policyAcknowledgements } = dataStore;
  const [dateRange, setDateRange] = useState<DateRangeState>({ ...defaultDateRange, preset: '30D' });
  const responseMetricsRef = useRef<HTMLDivElement | null>(null);
  const hasAnimatedRef = useRef(false);
  const reportsInWindow = reports.filter((report) => inDateRange(report.createdAt, dateRange));
  const deliveriesInWindow = deliveries.filter((delivery) => inDateRange(delivery.deliveredAt, dateRange));
  const responsesInWindow = responses.filter((response) => inDateRange(response.submittedAt, dateRange));
  
  // Calculate metrics
  const totalReports = reportsInWindow.length;
  const openReports = reportsInWindow.filter(r => !['RESOLVED', 'CLOSED'].includes(r.status)).length;
  const resolvedReports = reportsInWindow.filter(r => r.status === 'RESOLVED').length;
  const resolvedWithAge = reportsInWindow.filter((r) => ['RESOLVED', 'CLOSED'].includes(r.status));
  const avgResolutionDays = resolvedWithAge.length
    ? resolvedWithAge.reduce((sum, report) => sum + (report.updatedAt.getTime() - report.createdAt.getTime()) / (1000 * 60 * 60 * 24), 0) / resolvedWithAge.length
    : 0;
  
  // Category breakdown
  const categoryMap = reportsInWindow.reduce<Record<string, number>>((acc, report) => {
    acc[report.category] = (acc[report.category] ?? 0) + 1;
    return acc;
  }, {});
  const categoryData = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
  
  // Department health
  const departmentData = mockDepartments.map((department) => {
    const departmentUsers = dataStore.users.filter((u) => u.departmentId === department.id && u.role === 'EMPLOYEE');
    const reportCount = reportsInWindow.filter((report) => departmentUsers.some((u) => u.id === report.createdByUserId)).length;
    const riskLevel = reportCount > 6 ? 'HIGH' : reportCount > 2 ? 'MEDIUM' : 'LOW';
    return { deptId: department.id, name: department.name, reportCount, riskLevel };
  }).sort((a, b) => b.reportCount - a.reportCount);
  const responseRate = deliveriesInWindow.length ? responsesInWindow.length / deliveriesInWindow.length : 0;
  const trainingCompliance = policies.length
    ? policyAcknowledgements.length / (policies.length * dataStore.users.filter((u) => u.role === 'EMPLOYEE').length)
    : 0;
  const myAssigned = reportsInWindow.filter((report) => report.assignedTo === dataStore.currentUser.id);
  const myResolved = myAssigned.filter((report) => ['RESOLVED', 'CLOSED'].includes(report.status));
  const myAvgResolutionDays = myResolved.length
    ? myResolved.reduce((sum, report) => sum + (report.updatedAt.getTime() - report.createdAt.getTime()) / (1000 * 60 * 60 * 24), 0) / myResolved.length
    : 0;
  const reportsThisMonth = reportsInWindow.filter((r) => {
    const now = new Date();
    return r.createdAt.getMonth() === now.getMonth() && r.createdAt.getFullYear() === now.getFullYear();
  }).length;
  const [displayMetrics, setDisplayMetrics] = useState({
    responseRatePct: 0,
    trainingCompliancePct: 0,
    reportsThisMonth: 0,
  });

  useEffect(() => {
    hasAnimatedRef.current = false;
    setDisplayMetrics({ responseRatePct: 0, trainingCompliancePct: 0, reportsThisMonth: 0 });
  }, [dateRange]);

  useEffect(() => {
    const node = responseMetricsRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || hasAnimatedRef.current) return;
        hasAnimatedRef.current = true;
        const start = performance.now();
        const durationMs = 900;
        const targetResponseRate = Math.round(responseRate * 100);
        const targetTrainingCompliance = Math.round(trainingCompliance * 100);
        const targetReportsThisMonth = reportsThisMonth;
        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplayMetrics({
            responseRatePct: Math.round(targetResponseRate * eased),
            trainingCompliancePct: Math.round(targetTrainingCompliance * eased),
            reportsThisMonth: Math.round(targetReportsThisMonth * eased),
          });
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.2 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reportsThisMonth, responseRate, trainingCompliance]);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="analytics-header">
        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Analytics</h1>
        <p className="text-[var(--mismo-text-secondary)] mt-1">
          Comprehensive insights into your organization's compliance health
        </p>
      </div>
      <DateRangeFilter value={dateRange} onChange={setDateRange} />
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="metric-card mismo-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-[var(--mismo-text-secondary)]">Total Reports</p>
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                <Icons.reports className="h-4 w-4 text-gray-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--mismo-text)]">{totalReports}</p>
            <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">
              All time
            </p>
          </CardContent>
        </Card>
        
        <Card className="metric-card mismo-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-[var(--mismo-text-secondary)]">Open Reports</p>
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Icons.alertCircle className="h-4 w-4 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--mismo-text)]">{openReports}</p>
            <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">
              Awaiting resolution
            </p>
          </CardContent>
        </Card>
        
        <Card className="metric-card mismo-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-[var(--mismo-text-secondary)]">Resolved</p>
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <Icons.checkCircle className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--mismo-text)]">{resolvedReports}</p>
            <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">
              Successfully closed
            </p>
          </CardContent>
        </Card>
        
        <Card className="metric-card mismo-card">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-[var(--mismo-text-secondary)]">Avg Resolution Time</p>
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Icons.clock className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[var(--mismo-text)]">{avgResolutionDays.toFixed(1)}d</p>
            <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">
              Per report
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Report Categories */}
        <Card className="metric-card mismo-card">
          <CardContent className="p-5">
            <h3 className="font-semibold text-[var(--mismo-text)] mb-4">Reports by Category</h3>
            <p className="text-sm text-[var(--mismo-text-secondary)] mb-4">Last 90 days</p>
            <div className="space-y-4">
              {categoryData.map(([category, count]) => {
                const total = categoryData.reduce((sum, [, c]) => sum + c, 0);
                const percentage = (count / total) * 100;
                
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-[var(--mismo-text)]">{category}</span>
                      <span className="text-sm text-[var(--mismo-text-secondary)]">
                        {count} ({Math.round(percentage)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[var(--mismo-blue)] rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        
        {/* Department Health */}
        <Card className="metric-card mismo-card">
          <CardContent className="p-5">
            <h3 className="font-semibold text-[var(--mismo-text)] mb-4">Department Health</h3>
            <p className="text-sm text-[var(--mismo-text-secondary)] mb-4">Risk assessment by department</p>
            <div className="space-y-3">
              {departmentData.map((dept) => (
                <div key={dept.deptId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      dept.riskLevel === 'LOW' ? 'bg-green-500' :
                      dept.riskLevel === 'MEDIUM' ? 'bg-amber-500' :
                      'bg-red-500'
                    }`} />
                    <span className="font-medium text-[var(--mismo-text)]">{dept.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-[var(--mismo-text-secondary)]">
                      {dept.reportCount} reports
                    </span>
                    <Badge className={
                      dept.riskLevel === 'LOW' ? 'bg-green-100 text-green-700' :
                      dept.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }>
                      {dept.riskLevel}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Response Metrics */}
      <Card className="metric-card mismo-card">
        <CardContent className="p-5">
          <h3 className="font-semibold text-[var(--mismo-text)] mb-4">Response Metrics (30 Days)</h3>
          <div ref={responseMetricsRef} className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <button
              type="button"
              className="text-center p-4 border border-[var(--color-border-200)] bg-transparent shadow-[var(--shadow-1)] enterprise-interactive"
              onClick={() => onNavigate('prompt-responses', { rangePreset: '30D' })}
            >
              <p className="text-4xl font-bold text-[var(--color-primary-900)] [text-shadow:0_1px_1px_rgba(15,27,42,0.16)]">
                {displayMetrics.responseRatePct}%
              </p>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1 [text-shadow:0_1px_1px_rgba(15,27,42,0.1)]">Response Rate</p>
              <p className="text-xs text-[var(--color-emerald-600)] mt-1">+5% from last month</p>
            </button>
            <button
              type="button"
              className="text-center p-4 border border-[var(--color-border-200)] bg-transparent shadow-[var(--shadow-1)] enterprise-interactive"
              onClick={() => onNavigate('policies')}
              title="Company memos"
            >
              <p className="text-4xl font-bold text-[var(--color-primary-900)] [text-shadow:0_1px_1px_rgba(15,27,42,0.16)]">
                {displayMetrics.trainingCompliancePct}%
              </p>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1 [text-shadow:0_1px_1px_rgba(15,27,42,0.1)]">Memo acknowledgement</p>
              <p className="text-xs text-[var(--color-emerald-600)] mt-1">+2% from last month</p>
            </button>
            <button
              type="button"
              className="text-center p-4 border border-[var(--color-border-200)] bg-transparent shadow-[var(--shadow-1)] enterprise-interactive"
              onClick={() => onNavigate('reports')}
            >
              <p className="text-4xl font-bold text-[var(--color-primary-900)] [text-shadow:0_1px_1px_rgba(15,27,42,0.16)]">
                {displayMetrics.reportsThisMonth}
              </p>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1 [text-shadow:0_1px_1px_rgba(15,27,42,0.1)]">Reports This Month</p>
              <p className="text-xs text-[var(--color-emerald-600)] mt-1">+12% from last month</p>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="metric-card mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-5">
          <h3 className="mismo-heading text-2xl text-[var(--color-primary-900)]">Gina C. Performance Metrics</h3>
          <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">Personalized admin metrics for this reporting window</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="border border-[var(--color-border-200)] p-4 bg-[var(--color-surface-100)]">
              <p className="text-xs uppercase tracking-wide text-[var(--mismo-text-secondary)]">Your Response Rate</p>
              <p className="text-3xl font-semibold mt-2">{formatPercent(responseRate)}</p>
            </div>
            <div className="border border-[var(--color-border-200)] p-4 bg-[var(--color-surface-100)]">
              <p className="text-xs uppercase tracking-wide text-[var(--mismo-text-secondary)]">Your Avg Resolution Time</p>
              <p className="text-3xl font-semibold mt-2">{myAvgResolutionDays.toFixed(1)}d</p>
            </div>
            <div className="border border-[var(--color-border-200)] p-4 bg-[var(--color-surface-100)]">
              <p className="text-xs uppercase tracking-wide text-[var(--mismo-text-secondary)]">Reports Resolved By You</p>
              <p className="text-3xl font-semibold mt-2">{myResolved.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
