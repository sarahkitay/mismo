import { useState, useEffect } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icons } from '@/lib/icons';
import { downloadCsv } from '@/lib/exportCsv';
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

  const [historyTab, setHistoryTab] = useState('overview');
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

  const employeeInvestigations = dataStore.investigations.filter(
    (inv) =>
      inv.subjectUserIds?.includes(employee.id) ||
      inv.linkedReportIds.some((rid) => {
        const rep = dataStore.reports.find((r) => r.id === rid);
        return rep?.createdByUserId === employee.id;
      })
  );
  const employeeMemoAcks = dataStore.policyAcknowledgements.filter((a) => a.userId === employee.id);
  const employeeAuditLogs = dataStore.auditLogs.filter(
    (log) => log.recordId === employee.id || log.actorUserId === employee.id
  );

  const exportEmployeeReport = () => {
    const headers = ['Section', 'Id', 'Summary', 'Timestamp', 'Detail'];
    const rows: (string | number)[][] = [];
    rows.push([
      'Profile',
      employee.id,
      `${employee.firstName} ${employee.lastName}`,
      employee.createdAt.toISOString(),
      employee.email,
    ]);
    employeeReports.forEach((r) => {
      rows.push(['Case', r.id, r.summary, r.createdAt.toISOString(), r.status]);
    });
    employeeResponses.forEach((r) => {
      rows.push(['Prompt response', r.id, r.answer, r.submittedAt.toISOString(), r.promptId]);
    });
    employeeInvestigations.forEach((i) => {
      rows.push(['Investigation', i.id, i.referenceNumber ?? i.id, i.openedAt.toISOString(), i.status]);
    });
    employeeMemoAcks.forEach((a) => {
      const pol = dataStore.policies.find((p) => p.id === a.policyId);
      rows.push(['Memo acknowledgement', a.policyId, pol?.title ?? a.policyId, a.acknowledgedAt.toISOString(), a.outcome ?? '']);
    });
    nudgesToEmployee.forEach((n) => {
      rows.push(['Outreach / nudge', n.id, n.channel, n.sentAt.toISOString(), n.message]);
    });
    downloadCsv(`mismo-employee-${employee.id}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success('Employee report CSV downloaded.');
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
        <Button variant="outline" onClick={exportEmployeeReport}>
          Export employee report (CSV)
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
                Hire date: <span className="font-medium text-[var(--color-text-primary)]">{employee.hiredDate ? formatDate(employee.hiredDate) : '-'}</span>
                {' · '}
                Mismo record since: <span className="font-medium text-[var(--color-text-primary)]">{formatDate(employee.createdAt)}</span>
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
        </CardContent>
      </Card>

      <Card className="mismo-card">
        <CardContent className="p-5">
          <h2 className="section-label mb-3">Employee history</h2>
          <Tabs value={historyTab} onValueChange={setHistoryTab}>
            <TabsList className="flex flex-wrap h-auto gap-1 bg-[var(--color-surface-100)] p-1 border border-[var(--color-border-200)]">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="prompts" className="text-xs sm:text-sm">
                Prompt responses
              </TabsTrigger>
              <TabsTrigger value="memos" className="text-xs sm:text-sm">
                Memos
              </TabsTrigger>
              <TabsTrigger value="investigations" className="text-xs sm:text-sm">
                Investigations
              </TabsTrigger>
              <TabsTrigger value="cases" className="text-xs sm:text-sm">
                Case reports
              </TabsTrigger>
              <TabsTrigger value="outreach" className="text-xs sm:text-sm">
                Outreach / nudges
              </TabsTrigger>
              <TabsTrigger value="audit" className="text-xs sm:text-sm">
                Audit log
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-3">
              <div className="rounded-md border border-dashed border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-3 text-sm text-[var(--color-text-secondary)]">
                Assistant (preview): one-paragraph risk summary for this employee will appear here when connected to your model provider. No automated decisions are made from this panel.
              </div>
              <p className="text-sm text-[var(--color-text-secondary)]">
                This employee has {employeeResponses.length} prompt response(s), {employeeReports.length} submitted case report(s),{' '}
                {employeeInvestigations.length} linked investigation(s), and {nudgesToEmployee.length} logged outreach event(s).
              </p>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Recent activity</p>
                {employeeActivities.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">No recent activity rows for this employee.</p>
                ) : (
                  <ul className="space-y-1">
                    {employeeActivities.slice(0, 6).map((a) => (
                      <li key={a.id} className="text-sm text-[var(--color-text-secondary)]">
                        {a.type.replace(/_/g, ' ')} · {formatRelativeTime(a.createdAt)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent value="prompts" className="mt-4">
              {employeeResponses.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No prompt responses yet. Once this employee answers HR prompts, their responses will appear here.
                </p>
              ) : (
                <div className="overflow-x-auto border border-[var(--color-border-200)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]">
                      <tr>
                        <th className="px-3 py-2 text-left">Prompt</th>
                        <th className="px-3 py-2 text-left">Category</th>
                        <th className="px-3 py-2 text-left">Response</th>
                        <th className="px-3 py-2 text-left">Needs review</th>
                        <th className="px-3 py-2 text-left">Answered</th>
                        <th className="px-3 py-2 text-right">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeResponses.map((r) => {
                        const prompt = dataStore.prompts.find((p) => p.id === r.promptId);
                        const needsReview = r.answer === 'HAS_ISSUE' && !r.reviewedAt && r.needsReview !== false;
                        const reviewer = r.reviewedByUserId ? dataStore.users.find((u) => u.id === r.reviewedByUserId) : null;
                        return (
                          <tr key={r.id} className="border-t border-[var(--color-border-200)]">
                            <td className="px-3 py-2 font-medium">{prompt?.title ?? r.promptId}</td>
                            <td className="px-3 py-2 text-[var(--color-text-secondary)]">{prompt?.type ?? '-'}</td>
                            <td className="px-3 py-2">{r.answer}</td>
                            <td className="px-3 py-2">{needsReview ? 'Yes' : 'No'}{reviewer ? ` · ${reviewer.firstName}` : ''}</td>
                            <td className="px-3 py-2 text-[var(--color-text-secondary)]">{formatDate(r.submittedAt)}</td>
                            <td className="px-3 py-2 text-right">
                              <Button size="sm" variant="outline" onClick={() => onNavigate('prompt-response-detail', { id: r.id })}>
                                Open
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="memos" className="mt-4">
              {employeeMemoAcks.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No memo acknowledgements recorded for this employee yet. Published memos that require sign-off will show read and acknowledgement status here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {employeeMemoAcks.map((a) => {
                    const pol = dataStore.policies.find((p) => p.id === a.policyId);
                    return (
                      <li key={`${a.policyId}-${a.userId}`} className="border border-[var(--color-border-200)] p-3 rounded-[var(--radius-medium)] text-sm flex flex-wrap justify-between gap-2">
                        <div>
                          <p className="font-medium">{pol?.title ?? a.policyId}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">
                            Acknowledged {formatDate(a.acknowledgedAt)} · {a.outcome ?? 'Recorded'}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => onNavigate('policy-detail', { id: a.policyId })}>
                          Open memo
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="investigations" className="mt-4">
              {employeeInvestigations.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No investigations are linked to this employee yet. Escalations from the case register will appear here when opened.
                </p>
              ) : (
                <ul className="space-y-2">
                  {employeeInvestigations.map((inv) => (
                    <li key={inv.id} className="border border-[var(--color-border-200)] p-3 rounded-[var(--radius-medium)] text-sm flex flex-wrap justify-between gap-2">
                      <div>
                        <p className="font-medium">{inv.referenceNumber ?? inv.id}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {inv.status} · Opened {formatDate(inv.openedAt)} · Modified {formatDate(inv.updatedAt)}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => onNavigate('investigation-detail', { id: inv.id })}>
                        Open
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="cases" className="mt-4">
              {employeeReports.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No reports submitted for this employee yet. Any future incident reports, prompt escalations, or memo clarifications will appear here.
                </p>
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
            </TabsContent>

            <TabsContent value="outreach" className="mt-4 space-y-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Send reminders only with a clear reason. Messages are logged on this employee&apos;s record with channel, body, and sender.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const msg = window.prompt('Email reminder message:', 'Please complete your pending HR check-ins.');
                    if (msg == null) return;
                    dataStore.sendNudge(employee.id, 'EMAIL', msg, { type: 'AT_RISK_OUTREACH', relatedLabel: 'Manual admin outreach' });
                    toast.success('Email reminder logged.');
                  }}
                >
                  Send email reminder…
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const msg = window.prompt('SMS reminder message:', 'Reminder: please complete your HR check-ins.');
                    if (msg == null) return;
                    dataStore.sendNudge(employee.id, 'SMS', msg, { type: 'AT_RISK_OUTREACH', relatedLabel: 'Manual admin outreach' });
                    toast.success('SMS reminder logged.');
                  }}
                >
                  Send SMS reminder…
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const msg = window.prompt('Describe manual outreach:', 'Called employee to discuss engagement.');
                    if (msg == null) return;
                    dataStore.sendNudge(employee.id, 'MANUAL', msg, { type: 'MANUAL_OUTREACH', relatedLabel: 'Manual outreach' });
                    toast.success('Manual outreach logged.');
                  }}
                >
                  Log manual outreach…
                </Button>
              </div>
              {nudgesToEmployee.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  No reminders or manual outreach have been logged for this employee.
                </p>
              ) : (
                <ul className="space-y-2">
                  {nudgesToEmployee.map((n) => (
                    <li key={n.id} className="text-sm border border-[var(--color-border-200)] p-3 rounded-[var(--radius-medium)]">
                      <span className="font-medium">{n.channel}</span> · {formatRelativeTime(n.sentAt)}
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">{n.message}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {n.context.type}
                        {n.context.policyId ? ` · memo ${n.context.policyId}` : ''}
                        {n.context.promptId ? ` · prompt ${n.context.promptId}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              {employeeAuditLogs.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">No audit entries reference this employee yet.</p>
              ) : (
                <div className="overflow-x-auto border border-[var(--color-border-200)]">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]">
                      <tr>
                        <th className="px-3 py-2 text-left">Record</th>
                        <th className="px-3 py-2 text-left">Field</th>
                        <th className="px-3 py-2 text-left">Change</th>
                        <th className="px-3 py-2 text-left">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeAuditLogs.map((log) => (
                        <tr key={log.id} className="border-t border-[var(--color-border-200)]">
                          <td className="px-3 py-2">
                            {log.recordType} · {log.recordId}
                          </td>
                          <td className="px-3 py-2">{log.field ?? '-'}</td>
                          <td className="px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                            {(log.oldValue ?? '').slice(0, 40)} → {(log.newValue ?? '').slice(0, 40)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
