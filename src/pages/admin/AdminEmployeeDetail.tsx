import { useState, useEffect } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/lib/icons';
import {
  formatRelativeTime,
  formatDate,
  getCategoryLabel,
  getCategoryColor,
  getSeverityColor,
  getStatusColor,
  getInitials,
} from '@/lib/utils';
import { toast } from 'sonner';

interface AdminEmployeeDetailProps {
  dataStore: DataStore;
  employeeId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

function toDateInputValue(d: Date | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

export function AdminEmployeeDetail({ dataStore, employeeId, onNavigate }: AdminEmployeeDetailProps) {
  const employee = dataStore.users.find((u) => u.id === employeeId);
  if (!employee) return <div className="text-sm text-[var(--mismo-text-secondary)]">Employee not found.</div>;

  const [editingOrgInfo, setEditingOrgInfo] = useState(false);
  const [editManagerId, setEditManagerId] = useState(employee.managerId ?? '');
  const [editHiredDate, setEditHiredDate] = useState(toDateInputValue(employee.hiredDate));
  const [editEmployeeId, setEditEmployeeId] = useState(employee.employeeId ?? '');
  const [editLocation, setEditLocation] = useState(employee.location ?? '');
  const [editArchiveStart, setEditArchiveStart] = useState(toDateInputValue(employee.archiveStartDate));
  const [editArchiveEnd, setEditArchiveEnd] = useState(toDateInputValue(employee.archiveEndDate));

  const manager = employee.managerId ? dataStore.users.find((u) => u.id === employee.managerId) : null;
  const potentialManagers = dataStore.users.filter(
    (u) => u.id !== employee.id && ['HR', 'ADMIN', 'MANAGER'].includes(u.role)
  );

  useEffect(() => {
    setEditManagerId(employee.managerId ?? '');
    setEditHiredDate(toDateInputValue(employee.hiredDate));
    setEditEmployeeId(employee.employeeId ?? '');
    setEditLocation(employee.location ?? '');
    setEditArchiveStart(toDateInputValue(employee.archiveStartDate));
    setEditArchiveEnd(toDateInputValue(employee.archiveEndDate));
    setEditingOrgInfo(false);
  }, [employeeId]);

  const engagement = dataStore.getEmployeeEngagement(employee.id);
  const employeeReports = dataStore.reports.filter((r) => r.createdByUserId === employee.id);
  const employeeResponses = dataStore.responses.filter((r) => r.userId === employee.id);
  const employeeActivities = dataStore.activities
    .filter((a) => a.actorUserId === employee.id || (a.metadata as { userId?: string })?.userId === employee.id)
    .slice(0, 20)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const nudgesToEmployee = dataStore.nudges.filter((n) => n.targetUserId === employee.id);

  const handleViewAsEmployee = () => {
    dataStore.setPreviewUserId(employee.id);
    onNavigate('home', { previewEmployee: 'true' });
  };

  const handleSaveOrgInfo = () => {
    dataStore.updateUser(employee.id, {
      managerId: editManagerId || undefined,
      hiredDate: editHiredDate ? new Date(editHiredDate) : undefined,
      employeeId: editEmployeeId.trim() || undefined,
      location: editLocation.trim() || undefined,
      archiveStartDate: editArchiveStart ? new Date(editArchiveStart) : undefined,
      archiveEndDate: editArchiveEnd ? new Date(editArchiveEnd) : undefined,
    });
    setEditingOrgInfo(false);
    toast.success('Employee details updated.');
  };

  const handleCancelEdit = () => {
    setEditManagerId(employee.managerId ?? '');
    setEditHiredDate(toDateInputValue(employee.hiredDate));
    setEditEmployeeId(employee.employeeId ?? '');
    setEditLocation(employee.location ?? '');
    setEditArchiveStart(toDateInputValue(employee.archiveStartDate));
    setEditArchiveEnd(toDateInputValue(employee.archiveEndDate));
    setEditingOrgInfo(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => onNavigate('users')}>
          <Icons.arrowLeft className="h-4 w-4 mr-2" />
          Back to Employees
        </Button>
        <Button variant="default" onClick={handleViewAsEmployee} className="ml-auto">
          View as this employee
        </Button>
        <Button
          variant="outline"
          className="border-[var(--color-alert-600)] text-[var(--color-alert-600)] hover:bg-[var(--color-alert-50)]"
          onClick={() => {
            const now = new Date();
            const end = new Date(now);
            end.setFullYear(end.getFullYear() + 7);
            dataStore.updateUser(employee.id, {
              status: 'inactive',
              archiveStartDate: employee.archiveStartDate ?? now,
              archiveEndDate: employee.archiveEndDate ?? end,
            });
            onNavigate('users');
          }}
        >
          Archive employee
        </Button>
      </div>

      <Card className="mismo-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center border border-[var(--color-border-200)]">
              <span className="text-lg font-semibold text-[var(--color-primary-900)]">
                {getInitials(employee.firstName, employee.lastName)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
                {employee.firstName} {employee.lastName}
              </h1>
              <p className="text-[var(--color-text-secondary)]">{employee.email}</p>
              {employee.phone && <p className="text-sm text-[var(--color-text-muted)]">{employee.phone}</p>}
              <p className="text-sm mt-1">
                Role: {employee.role} · Status:{' '}
                <span className={employee.status === 'active' ? 'text-emerald-700' : 'text-slate-600'}>{employee.status}</span>
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                Employee ID: <span className="font-medium text-[var(--color-text-primary)]">{employee.employeeId?.trim() || '-'}</span>
                {' · '}
                System: <code className="text-xs bg-[var(--color-surface-200)] px-1 rounded">{employee.id}</code>
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                Location: <span className="text-[var(--color-text-primary)]">{employee.location?.trim() || '-'}</span>
              </p>
              {(employee.archiveStartDate || employee.archiveEndDate) && (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Archive window:{' '}
                  {employee.archiveStartDate ? formatDate(employee.archiveStartDate) : '-'} →{' '}
                  {employee.archiveEndDate ? formatDate(employee.archiveEndDate) : '-'}
                </p>
              )}
              {employee.state && <p className="text-sm text-[var(--color-text-muted)]">State: {employee.state}</p>}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border-200)]">
            {!editingOrgInfo ? (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-[var(--color-primary-700)]" onClick={() => setEditingOrgInfo(true)}>
                <Icons.edit className="h-3.5 w-3.5 mr-1" />
                Edit employee record
              </Button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Employee ID</p>
              {editingOrgInfo ? (
                <input
                  type="text"
                  value={editEmployeeId}
                  onChange={(e) => setEditEmployeeId(e.target.value)}
                  className="mt-0.5 h-9 w-full max-w-xs rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-3 text-sm"
                  placeholder="Company / badge number"
                />
              ) : (
                <p className="font-medium text-[var(--color-text-primary)]">{employee.employeeId?.trim() || '-'}</p>
              )}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Location</p>
              {editingOrgInfo ? (
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="mt-0.5 h-9 w-full max-w-xs rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-3 text-sm"
                  placeholder="Office, site, or region"
                />
              ) : (
                <p className="font-medium text-[var(--color-text-primary)]">{employee.location?.trim() || '-'}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Archive start</p>
              {editingOrgInfo ? (
                <input
                  type="date"
                  value={editArchiveStart}
                  onChange={(e) => setEditArchiveStart(e.target.value)}
                  className="mt-0.5 h-9 w-full max-w-[180px] rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-3 text-sm"
                />
              ) : (
                <p className="font-medium text-[var(--color-text-primary)]">
                  {employee.archiveStartDate ? formatDate(employee.archiveStartDate) : '-'}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Archive end</p>
              {editingOrgInfo ? (
                <input
                  type="date"
                  value={editArchiveEnd}
                  onChange={(e) => setEditArchiveEnd(e.target.value)}
                  className="mt-0.5 h-9 w-full max-w-[180px] rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-3 text-sm"
                />
              ) : (
                <p className="font-medium text-[var(--color-text-primary)]">
                  {employee.archiveEndDate ? formatDate(employee.archiveEndDate) : '-'}
                </p>
              )}
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Direct manager</p>
              {editingOrgInfo ? (
                <select
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                  className="mt-0.5 h-9 w-full max-w-xs rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-3 text-sm"
                >
                  <option value="">(None)</option>
                  {potentialManagers.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                  ))}
                </select>
              ) : (
                <p className="font-medium text-[var(--color-text-primary)]">{manager ? `${manager.firstName} ${manager.lastName}` : '-'}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Hired date</p>
              {editingOrgInfo ? (
                <input
                  type="date"
                  value={editHiredDate}
                  onChange={(e) => setEditHiredDate(e.target.value)}
                  className="mt-0.5 h-9 w-full max-w-[180px] rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-3 text-sm"
                />
              ) : (
                <p className="font-medium text-[var(--color-text-primary)]">{employee.hiredDate ? formatDate(employee.hiredDate) : '-'}</p>
              )}
            </div>
            {editingOrgInfo && (
              <div className="flex items-end gap-2 sm:col-span-2">
                <Button size="sm" onClick={handleSaveOrgInfo}>Save</Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit}>Cancel</Button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[var(--color-border-200)]">
            <div className="p-3 border border-[var(--color-border-200)] rounded-[var(--radius-medium)]">
              <p className="text-xs text-[var(--color-text-secondary)] uppercase">Response rate (30d)</p>
              <p className="font-semibold">{Math.round((engagement?.responseRate30d ?? 0) * 100)}%</p>
            </div>
            <div className="p-3 border border-[var(--color-border-200)] rounded-[var(--radius-medium)]">
              <p className="text-xs text-[var(--color-text-secondary)] uppercase">Pending prompts</p>
              <p className="font-semibold">{engagement?.pendingPrompts ?? 0}</p>
            </div>
            <div className="p-3 border border-[var(--color-border-200)] rounded-[var(--radius-medium)]">
              <p className="text-xs text-[var(--color-text-secondary)] uppercase">Reports</p>
              <p className="font-semibold">{employeeReports.length}</p>
            </div>
            <div className="p-3 border border-[var(--color-border-200)] rounded-[var(--radius-medium)]">
              <p className="text-xs text-[var(--color-text-secondary)] uppercase">Last response</p>
              <p className="font-semibold text-sm">{engagement?.lastResponseAt ? formatRelativeTime(engagement.lastResponseAt) : 'Never'}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => dataStore.sendNudge(employee.id, 'EMAIL', 'Please complete pending prompts.', { type: 'AT_RISK_OUTREACH' })}>
              Send Email Reminder
            </Button>
            <Button variant="outline" size="sm" onClick={() => dataStore.sendNudge(employee.id, 'SMS', 'Please complete pending prompts.', { type: 'AT_RISK_OUTREACH' })}>
              Send SMS Reminder
            </Button>
            <Button variant="outline" size="sm" onClick={() => dataStore.sendNudge(employee.id, 'MANUAL', 'Direct outreach performed.', { type: 'AT_RISK_OUTREACH' })}>
              Log Manual Outreach
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mismo-card">
        <CardContent className="p-5">
          <h2 className="section-label mb-3">Report info</h2>
          {employeeReports.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No reports submitted.</p>
          ) : (
            <div className="space-y-2">
              {employeeReports.map((report) => (
                <div
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-[var(--color-border-200)] p-3 rounded-[var(--radius-medium)]"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{report.summary}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{report.id} · {formatDate(report.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={getCategoryColor(report.category)}>{getCategoryLabel(report.category)}</Badge>
                    <Badge className={getSeverityColor(report.severity)}>{report.severity}</Badge>
                    <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
                    <Button variant="outline" size="sm" onClick={() => onNavigate('report-detail', { id: report.id })}>
                      Open case
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mismo-card">
        <CardContent className="p-5">
          <h2 className="section-label mb-3">Prompt responses</h2>
          {employeeResponses.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No prompt responses yet.</p>
          ) : (
            <ul className="space-y-2">
              {employeeResponses.slice(0, 15).map((r) => {
                const prompt = dataStore.prompts.find((p) => p.id === r.promptId);
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-2 border border-[var(--color-border-200)] p-2 rounded-[var(--radius-medium)] text-sm">
                    <span className="font-medium">{prompt?.title ?? r.promptId}</span>
                    <Badge variant={r.answer === 'HAS_ISSUE' ? 'destructive' : 'secondary'}>{r.answer === 'HAS_ISSUE' ? 'Had issue' : 'No issue'}</Badge>
                    <span className="text-[var(--color-text-muted)]">{formatRelativeTime(r.submittedAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mismo-card">
        <CardContent className="p-5">
          <h2 className="section-label mb-3">Nudges / reminders sent</h2>
          {nudgesToEmployee.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">None.</p>
          ) : (
            <ul className="space-y-2">
              {nudgesToEmployee.slice(0, 10).map((n) => (
                <li key={n.id} className="text-sm border border-[var(--color-border-200)] p-2 rounded-[var(--radius-medium)]">
                  <span className="font-medium">{n.channel}</span> · {formatRelativeTime(n.sentAt)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mismo-card">
        <CardContent className="p-5">
          <h2 className="section-label mb-3">Recent activity</h2>
          {employeeActivities.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No activity.</p>
          ) : (
            <ul className="space-y-2">
              {employeeActivities.map((a) => (
                <li key={a.id} className="text-sm border border-[var(--color-border-200)] p-2 rounded-[var(--radius-medium)]">
                  <span className="font-medium">{a.type}</span> · {formatRelativeTime(a.createdAt)}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
