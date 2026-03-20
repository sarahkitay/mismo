import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/lib/icons';
import { formatDate, formatRelativeTime, getCategoryColor, getCategoryLabel, getSeverityColor, getStatusColor } from '@/lib/utils';

interface AdminInvestigationDetailProps {
  dataStore: DataStore;
  investigationId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export function AdminInvestigationDetail({ dataStore, investigationId, onNavigate }: AdminInvestigationDetailProps) {
  const investigation = dataStore.investigations.find((i) => i.id === investigationId);
  if (!investigation) return <div className="text-sm text-[var(--mismo-text-secondary)]">Investigation not found.</div>;
  const linkedReports = dataStore.reports.filter((r) => investigation.linkedReportIds.includes(r.id));
  const owner = dataStore.users.find((u) => u.id === investigation.ownerId);
  const investigationAgeDays = Math.max(
    0,
    Math.floor((Date.now() - investigation.openedAt.getTime()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div className="space-y-6">
      <Button variant="ghost" className="enterprise-interactive w-fit" onClick={() => onNavigate('investigations')}>
        <Icons.arrowLeft className="h-4 w-4 mr-2" />
        Back to Investigations
      </Button>

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Investigation Record</p>
              <h1 className="mismo-heading text-3xl text-[var(--color-primary-900)] mt-1">
                Investigation {investigation.id.toUpperCase()}
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                Procedural case register with audit-ready linked report evidence.
              </p>
            </div>
            <Badge className={investigation.status === 'OPEN' ? 'status-chip status-chip--warn' : 'status-chip status-chip--success'}>
              {investigation.status}
            </Badge>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-200)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Owner</p>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1">
                {owner ? `${owner.firstName} ${owner.lastName}` : 'Unassigned'}
              </p>
            </div>
            <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-200)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Opened</p>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1">{formatDate(investigation.openedAt)}</p>
            </div>
            <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-200)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Age</p>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1">{investigationAgeDays} days open</p>
            </div>
            <div className="border border-[var(--color-border-200)] bg-[var(--color-surface-200)] p-3">
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Linked Reports</p>
              <p className="text-sm font-medium text-[var(--color-text-primary)] mt-1">{linkedReports.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mismo-card border border-[var(--color-border-200)]">
        <CardContent className="p-0">
          <div className="px-5 py-4 border-b border-[var(--color-border-200)]">
            <h2 className="mismo-heading text-2xl text-[var(--color-primary-900)]">Linked Reports</h2>
          </div>
          <div className="divide-y divide-[var(--color-border-200)]">
            {linkedReports.map((report) => (
              <div key={report.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--color-text-primary)]">Case #{report.id.replace('report-', '').toUpperCase()}</p>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1">{report.summary}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">Updated {formatRelativeTime(report.updatedAt)}</p>
                  <div className="mt-2 text-xs text-[var(--color-text-secondary)] space-y-1">
                    {report.responsePlan && <p><span className="font-medium">Planned:</span> {report.responsePlan}</p>}
                    {report.responseActionTaken && <p><span className="font-medium">Action:</span> {report.responseActionTaken}</p>}
                    {report.employeeResponseOutcome && <p><span className="font-medium">Employee outcome:</span> {report.employeeResponseOutcome}</p>}
                    <p>
                      <span className="font-medium">Checklist progress:</span>{' '}
                      {(report.responseChecklist ?? []).filter((item) => item.completed).length}/{(report.responseChecklist ?? []).length}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={getCategoryColor(report.category)}>{getCategoryLabel(report.category)}</Badge>
                  <Badge className={getSeverityColor(report.severity)}>{report.severity}</Badge>
                  <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="enterprise-interactive"
                    onClick={() => onNavigate('report-detail', { id: report.id })}
                  >
                    Open Case
                  </Button>
                </div>
              </div>
            ))}
            {linkedReports.length === 0 && (
              <p className="px-5 py-6 text-sm text-[var(--color-text-secondary)]">No reports linked to this investigation.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
