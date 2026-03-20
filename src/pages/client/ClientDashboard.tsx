import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { formatPercent } from '@/lib/utils';

interface ClientDashboardProps {
  dataStore: DataStore;
}

export function ClientDashboard({ dataStore }: ClientDashboardProps) {
  const { reports, investigations, dashboardCounts, currentUser } = dataStore;
  const openReports = reports.filter((r) => !['RESOLVED', 'CLOSED'].includes(r.status)).length;
  const resolved = reports.filter((r) => r.status === 'RESOLVED' || r.status === 'CLOSED').length;
  const resolutionRate = reports.length ? resolved / reports.length : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Client Risk Overview</h1>
        <p className="text-[var(--mismo-text-secondary)] mt-1">
          Read-only view for executives and external clients: see report and investigation counts without full HR access. Viewer: {currentUser.firstName}.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="mismo-card"><CardContent className="p-4"><p className="text-sm text-[var(--mismo-text-secondary)]">Open Reports</p><p className="text-3xl font-bold">{openReports}</p></CardContent></Card>
        <Card className="mismo-card"><CardContent className="p-4"><p className="text-sm text-[var(--mismo-text-secondary)]">Critical Reports</p><p className="text-3xl font-bold">{dashboardCounts.criticalReports}</p></CardContent></Card>
        <Card className="mismo-card"><CardContent className="p-4"><p className="text-sm text-[var(--mismo-text-secondary)]">Open Investigations</p><p className="text-3xl font-bold">{investigations.filter((i) => i.status === 'OPEN').length}</p></CardContent></Card>
        <Card className="mismo-card"><CardContent className="p-4"><p className="text-sm text-[var(--mismo-text-secondary)]">Resolution Rate</p><p className="text-3xl font-bold">{formatPercent(resolutionRate)}</p></CardContent></Card>
      </div>
    </div>
  );
}
