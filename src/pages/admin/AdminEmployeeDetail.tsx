import { useState, useEffect, useMemo } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import type { UserStatus } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Icons } from '@/lib/icons';
import { downloadCsv } from '@/lib/exportCsv';
import { OutreachReminderModal } from '@/components/admin/OutreachReminderModal';
import { ManualOutreachModal } from '@/components/admin/ManualOutreachModal';
import { EmployeeHistoryReportDialog } from '@/components/admin/EmployeeHistoryReportDialog';
import {
 formatRelativeTime,
 formatDate,
 formatPercent,
 getCategoryLabel,
 getStatusColor,
 getInitials,
} from '@/lib/utils';
import { toast } from 'sonner';
import {
 activityNavTarget,
 findInvestigationForReport,
 findReportForPromptResponse,
} from '@/lib/recordLinks';
import { formatCaseReference } from '@/lib/caseTypes';
import { getInvestigationDisplayId } from '@/lib/investigationWorkflow';
import {
  buildEmployeePromptRegisterRows,
  exportEmployeePromptRegisterCsv,
} from '@/lib/employeePromptRegister';

interface AdminEmployeeDetailProps {
  dataStore: DataStore;
  employeeId: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialTab?: string;
}

function toDateInputValue(d: Date | undefined): string {
 if (!d) return '';
 const date = d instanceof Date ? d : new Date(d);
 return date.toISOString().slice(0, 10);
}

export function AdminEmployeeDetail({ dataStore, employeeId, onNavigate, initialTab }: AdminEmployeeDetailProps) {
  const employee = dataStore.users.find((u) => u.id === employeeId);
  if (!employee) return <div className="text-sm text-[var(--mismo-text-secondary)]">Employee not found.</div>;

  const [historyTab, setHistoryTab] = useState(initialTab ?? 'overview');
 const [reminderOpen, setReminderOpen] = useState(false);
 const [manualOpen, setManualOpen] = useState(false);
 const [reportOpen, setReportOpen] = useState(false);
 const [editingOrgInfo, setEditingOrgInfo] = useState(false);
 const [editManagerId, setEditManagerId] = useState(employee.managerId ?? '');
 const [editHiredDate, setEditHiredDate] = useState(toDateInputValue(employee.hiredDate));
 const [editEmployeeId, setEditEmployeeId] = useState(employee.employeeId ?? '');
 const [editLocation, setEditLocation] = useState(employee.location ?? '');
 const [editArchiveStart, setEditArchiveStart] = useState(toDateInputValue(employee.archiveStartDate));
 const [editArchiveEnd, setEditArchiveEnd] = useState(toDateInputValue(employee.archiveEndDate));
 const [editStatus, setEditStatus] = useState<UserStatus>(employee.status);

 const manager = employee.managerId ? dataStore.users.find((u) => u.id === employee.managerId) : null;
 const potentialManagers = dataStore.users.filter(
 (u) => u.id !== employee.id && ['HR', 'ADMIN', 'MANAGER'].includes(u.role)
 );

  useEffect(() => {
    if (initialTab) setHistoryTab(initialTab);
  }, [employeeId, initialTab]);

  useEffect(() => {
    setEditManagerId(employee.managerId ?? '');
    setEditHiredDate(toDateInputValue(employee.hiredDate));
    setEditEmployeeId(employee.employeeId ?? '');
    setEditLocation(employee.location ?? '');
    setEditArchiveStart(toDateInputValue(employee.archiveStartDate));
    setEditArchiveEnd(toDateInputValue(employee.archiveEndDate));
    setEditStatus(employee.status);
    setEditingOrgInfo(false);
  }, [employeeId, employee.managerId, employee.hiredDate, employee.employeeId, employee.location, employee.archiveStartDate, employee.archiveEndDate, employee.status]);

  const employeePromptRows = useMemo(
    () =>
      buildEmployeePromptRegisterRows(
        employee.id,
        dataStore.users,
        dataStore.deliveries,
        dataStore.responses,
        dataStore.prompts
      ),
    [employee.id, dataStore.users, dataStore.deliveries, dataStore.responses, dataStore.prompts]
  );

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
 status: editStatus,
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
 setEditStatus(employee.status);
 setEditingOrgInfo(false);
 };

 const employeeInvestigations = dataStore.investigations.filter(
 (inv) =>
 inv.subjectUserIds?.includes(employee.id) ||
 inv.witnessUserIds?.includes(employee.id) ||
 inv.linkedReportIds.some((rid) => {
 const rep = dataStore.reports.find((r) => r.id === rid);
 return rep?.createdByUserId === employee.id;
 })
 );
 const employeeMemoAcks = dataStore.policyAcknowledgements.filter((a) => a.userId === employee.id);
 const employeeAuditLogs = dataStore.auditLogs.filter(
 (log) => log.recordId === employee.id || log.actorUserId === employee.id
 );

 const openInvestigationsCount = employeeInvestigations.filter((i) => i.status === 'OPEN').length;
 const memoAckRate = useMemo(() => {
 const required = dataStore.policies.filter((p) => p.status === 'PUBLISHED' && p.acknowledgmentRequired);
 if (required.length === 0) return 1;
 const acked = required.filter((p) => employeeMemoAcks.some((a) => a.policyId === p.id)).length;
 return acked / required.length;
 }, [dataStore.policies, employeeMemoAcks]);

 const investigationsReportedBy = employeeInvestigations.filter((inv) =>
 inv.linkedReportIds.some((rid) => {
 const rep = dataStore.reports.find((r) => r.id === rid);
 return rep?.createdByUserId === employee.id;
 })
 );
 const investigationsAgainst = employeeInvestigations.filter(
 (inv) => inv.subjectUserIds?.includes(employee.id) && !investigationsReportedBy.some((x) => x.id === inv.id)
 );
 const investigationsWitness = employeeInvestigations.filter((inv) => inv.witnessUserIds?.includes(employee.id));

 const outreachRelatedOptions = useMemo(() => {
 const opts: { id: string; label: string }[] = [];
 employeeReports.forEach((r) => opts.push({ id: `report:${r.id}`, label: `Report · ${r.summary.slice(0, 40)}` }));
 employeeResponses.forEach((r) => {
 const prompt = dataStore.prompts.find((p) => p.id === r.promptId);
 opts.push({ id: `prompt:${r.id}`, label: `Prompt · ${prompt?.title ?? r.promptId}` });
 });
 employeeMemoAcks.forEach((a) => {
 const pol = dataStore.policies.find((p) => p.id === a.policyId);
 opts.push({ id: `memo:${a.policyId}`, label: `Memo · ${pol?.title ?? a.policyId}` });
 });
 return opts;
 }, [employeeReports, employeeResponses, employeeMemoAcks, dataStore.prompts, dataStore.policies]);

 const activityTimeline = useMemo(() => {
 const items: { id: string; at: Date; label: string; detail?: string }[] = [];
 employeeActivities.forEach((a) =>
 items.push({ id: a.id, at: a.createdAt, label: a.type.replace(/_/g, ' '), detail: JSON.stringify(a.metadata).slice(0, 80) })
 );
 employeeAuditLogs.forEach((log) =>
 items.push({
 id: log.id,
 at: log.createdAt,
 label: `${log.recordType} · ${log.field ?? 'update'}`,
 detail: `${log.oldValue ?? ''} → ${log.newValue ?? ''}`,
 })
 );
 nudgesToEmployee.forEach((n) =>
 items.push({ id: n.id, at: n.sentAt, label: `${n.channel} reminder`, detail: n.message })
 );
 return items.sort((a, b) => b.at.getTime() - a.at.getTime());
 }, [employeeActivities, employeeAuditLogs, nudgesToEmployee]);

 const renderInvestigationTable = (rows: typeof employeeInvestigations, emptyMessage: string) => {
 if (rows.length === 0) {
 return <p className="text-sm text-[var(--color-text-secondary)]">{emptyMessage}</p>;
 }
 return (
 <div className="overflow-x-auto border border-[var(--color-border-200)]">
 <table className="w-full text-sm">
 <thead className="bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]">
 <tr>
 <th className="px-3 py-2 text-left">Investigation</th>
 <th className="px-3 py-2 text-left">Initiated</th>
 <th className="px-3 py-2 text-left">Modified</th>
 <th className="px-3 py-2 text-left">Investigator</th>
 <th className="px-3 py-2 text-left">Status</th>
 <th className="px-3 py-2 text-left">Stage</th>
 <th className="px-3 py-2 text-left">Docs</th>
 <th className="px-3 py-2 text-left">Notes</th>
 <th className="px-3 py-2 text-right">Action</th>
 </tr>
 </thead>
 <tbody>
 {rows.map((inv) => {
 const investigator = dataStore.users.find((u) => u.id === inv.ownerId);
 const noteCount = inv.notes?.length ?? 0;
 const docCount = (inv.notes ?? []).reduce((sum, n) => sum + (n.attachments?.length ?? 0), 0) + (inv.outcomeAttachment ? 1 : 0);
 return (
 <tr
 key={inv.id}
 className="border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)] cursor-pointer"
 onClick={() => onNavigate('investigation-detail', { id: inv.id, tab: 'page-1' })}
 >
 <td className="px-3 py-2 font-medium text-[var(--mismo-blue)]">
 {getInvestigationDisplayId(inv)}
 </td>
 <td className="px-3 py-2 whitespace-nowrap">{formatDate(inv.openedAt)}</td>
 <td className="px-3 py-2 whitespace-nowrap">{formatRelativeTime(inv.updatedAt)}</td>
 <td className="px-3 py-2">{investigator ? `${investigator.firstName} ${investigator.lastName}` : 'Unassigned'}</td>
 <td className="px-3 py-2">{inv.status}</td>
 <td className="px-3 py-2 text-xs">{inv.workflowPhase ?? 'QUEUED'}</td>
 <td className="px-3 py-2">{docCount}</td>
 <td className="px-3 py-2">{noteCount}</td>
 <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
 <Button size="sm" variant="outline" onClick={() => onNavigate('investigation-detail', { id: inv.id, tab: 'page-1' })}>
 View
 </Button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 );
 };

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
 employeePromptRows.forEach((r) => {
 rows.push([
 'Check-in',
 r.id,
 r.promptTitle,
 r.date.toISOString(),
 r.answer === 'HAS_ISSUE' ? 'Yes' : r.answer === 'NO_ISSUE' ? 'No' : 'Unanswered',
 ]);
 });
 employeeReports.forEach((r) => {
 rows.push(['Case', r.id, r.summary, r.createdAt.toISOString(), r.status]);
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
 activityTimeline.forEach((item) => {
 rows.push(['Activity', item.id, item.label, item.at.toISOString(), item.detail ?? '']);
 });
 downloadCsv(`mismo-employee-history-${employee.employeeId ?? employee.id}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
 toast.success('Employee history report exported.');
 };

 return (
 <div className="space-y-6">
 <div className="flex flex-wrap items-center gap-2">
 <Button variant="ghost" onClick={() => onNavigate('users')}>
 <Icons.arrowLeft className="h-4 w-4 mr-2" />
 Back to Employees
 </Button>
 <div className="ml-auto flex flex-wrap items-center gap-2">
 <Button variant="default" onClick={handleViewAsEmployee}>
 View as this employee
 </Button>
 <Button variant="outline" onClick={() => setReportOpen(true)}>
 Employee history report
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
 {editingOrgInfo && (
 <div className="rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] p-3 text-xs text-[var(--color-text-secondary)] space-y-1">
 <p>
 <span className="font-medium text-[var(--mismo-text)]">Optional fields</span> (location, employee ID, hire date, manager, archive dates) can be cleared: empty the field and save.
 </p>
 <p>
 <span className="font-medium text-[var(--mismo-text)]">Employment status</span> is Active or Inactive below. Use Archive employee to move someone off the active roster with a retention window.
 </p>
 <p>
 <span className="font-medium text-[var(--mismo-text)]">History is retained:</span> check-ins, cases, memos, and outreach on this profile are not deleted when you edit the record.
 </p>
 </div>
 )}
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
 <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Employment status</p>
 {editingOrgInfo ? (
 <select
 value={editStatus}
 onChange={(e) => setEditStatus(e.target.value as UserStatus)}
 className="mt-0.5 h-9 w-full max-w-[180px] rounded-md border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-3 text-sm"
 >
 <option value="active">Active</option>
 <option value="inactive">Inactive</option>
 </select>
 ) : (
 <p className="font-medium text-[var(--color-text-primary)] capitalize">{employee.status}</p>
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
 <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 pt-3 border-t border-[var(--color-border-200)]">
 <div className="p-3 border border-[var(--color-border-200)] rounded-[var(--radius-medium)]">
 <p className="text-xs text-[var(--color-text-secondary)] uppercase">Last response</p>
 <p className="font-semibold text-sm">{engagement?.lastResponseAt ? formatRelativeTime(engagement.lastResponseAt) : 'Never'}</p>
 </div>
 <div className="p-3 border border-[var(--color-border-200)] rounded-[var(--radius-medium)]">
 <p className="text-xs text-[var(--color-text-secondary)] uppercase">Response rate (30d)</p>
 <p className="font-semibold">{Math.round((engagement?.responseRate30d ?? 0) * 100)}%</p>
 </div>
 <div className="p-3 border border-[var(--color-border-200)] rounded-[var(--radius-medium)]">
 <p className="text-xs text-[var(--color-text-secondary)] uppercase">Pending prompts</p>
 <button
 type="button"
 className="font-semibold text-left hover:text-[var(--mismo-blue)]"
 onClick={() => onNavigate('prompt-responses', { view: 'prompts', employeeId: employee.id, rangePreset: 'ALL', channel: 'incident' })}
 >
 {engagement?.pendingPrompts ?? 0}
 </button>
 </div>
 <div className="p-3 border border-[var(--color-border-200)] rounded-[var(--radius-medium)]">
 <p className="text-xs text-[var(--color-text-secondary)] uppercase">Reports</p>
 <p className="font-semibold">{employeeReports.length}</p>
 </div>
 <div className="p-3 border border-[var(--color-border-200)] rounded-[var(--radius-medium)]">
 <p className="text-xs text-[var(--color-text-secondary)] uppercase">Open investigations</p>
 <p className="font-semibold">{openInvestigationsCount}</p>
 </div>
 <div className="p-3 border border-[var(--color-border-200)] rounded-[var(--radius-medium)]">
 <p className="text-xs text-[var(--color-text-secondary)] uppercase">Memo ack rate</p>
 <p className="font-semibold">{formatPercent(memoAckRate)}</p>
 </div>
 <div className="p-3 border border-[var(--color-border-200)] rounded-[var(--radius-medium)]">
 <p className="text-xs text-[var(--color-text-secondary)] uppercase">Risk status</p>
 <p className={`font-semibold text-sm ${engagement?.isAtRisk ? 'text-[var(--color-alert-600)]' : 'text-emerald-700'}`}>
 {engagement?.isAtRisk ? 'At risk' : 'Normal'}
 </p>
 </div>
 </div>
 </CardContent>
 </Card>

 <Card className="mismo-card">
 <CardContent className="p-5">
 <h2 className="section-label mb-3">Employee report / history</h2>
 <Tabs value={historyTab} onValueChange={setHistoryTab}>
 <TabsList className="flex flex-wrap h-auto gap-1 bg-[var(--color-surface-100)] p-1 border border-[var(--color-border-200)]">
 <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
 <TabsTrigger value="reports" className="text-xs sm:text-sm">Reports</TabsTrigger>
 <TabsTrigger value="prompts" className="text-xs sm:text-sm">Prompt responses</TabsTrigger>
 <TabsTrigger value="memos" className="text-xs sm:text-sm">Memos / acknowledgements</TabsTrigger>
 <TabsTrigger value="investigations" className="text-xs sm:text-sm">Investigations</TabsTrigger>
 <TabsTrigger value="outreach" className="text-xs sm:text-sm">Reminders / outreach</TabsTrigger>
 <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity timeline</TabsTrigger>
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

 <TabsContent value="prompts" className="mt-4 space-y-4">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <p className="text-sm text-[var(--color-text-secondary)]">
 Includes answered check-ins, pending prompts, and linked cases for reporting.
 </p>
 <div className="flex flex-wrap gap-2">
 <Button
 size="sm"
 variant="outline"
 onClick={() => onNavigate('prompt-responses', { view: 'prompts', employeeId: employee.id, rangePreset: 'ALL', channel: 'incident' })}
 >
 Open in check-in register
 </Button>
 <Button
 size="sm"
 variant="outline"
 onClick={() => {
 const exportData = exportEmployeePromptRegisterCsv(
 employeePromptRows,
 dataStore.reports,
 `${employee.firstName} ${employee.lastName}`,
 employee.employeeId ?? employee.id
 );
 downloadCsv(exportData.filename, exportData.headers, exportData.rows);
 toast.success('Employee check-in report exported.');
 }}
 >
 Export CSV
 </Button>
 </div>
 </div>
 {employeePromptRows.length === 0 ? (
 <p className="text-sm text-[var(--color-text-secondary)]">
 No prompt responses or pending check-ins yet for this employee.
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
 <th className="px-3 py-2 text-left">Date</th>
 <th className="px-3 py-2 text-left">Linked case</th>
 <th className="px-3 py-2 text-left">Investigation</th>
 <th className="px-3 py-2 text-right">Link</th>
 </tr>
 </thead>
 <tbody>
 {employeePromptRows.map((r) => {
 const needsReview = r.needsReview;
 const linkedCase = r.answer === 'UNANSWERED' ? undefined : findReportForPromptResponse(r.id, dataStore.reports);
 const linkedInv = linkedCase
 ? findInvestigationForReport(linkedCase, dataStore.investigations)
 : dataStore.investigations.find((i) => i.linkedPromptResponseId === r.id);
 const openRow = () => {
 if (r.answer === 'UNANSWERED') {
 onNavigate('prompt-response-detail', { id: r.id });
 return;
 }
 onNavigate('prompt-response-detail', { id: r.id, type: r.answer });
 };
 return (
 <tr
 key={r.id}
 className="border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)] cursor-pointer"
 onClick={openRow}
 >
 <td className="px-3 py-2 font-medium">{r.promptTitle}</td>
 <td className="px-3 py-2 text-[var(--color-text-secondary)]">{r.promptType}</td>
 <td className="px-3 py-2">{r.answer === 'HAS_ISSUE' ? 'Yes' : r.answer === 'NO_ISSUE' ? 'No' : 'Unanswered'}</td>
 <td className="px-3 py-2">{r.answer === 'UNANSWERED' ? 'Pending' : needsReview ? 'Yes' : 'No'}</td>
 <td className="px-3 py-2 text-[var(--color-text-secondary)]">{formatDate(r.date)}</td>
 <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
 {linkedCase ? (
 <button
 type="button"
 className="text-[var(--mismo-blue)] hover:underline"
 onClick={() => onNavigate('report-detail', { id: linkedCase.id })}
 >
 {formatCaseReference(linkedCase)}
 </button>
 ) : (
 '-'
 )}
 </td>
 <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
 {linkedInv ? (
 <button
 type="button"
 className="text-[var(--mismo-blue)] hover:underline"
 onClick={() => onNavigate('investigation-detail', { id: linkedInv.id, tab: 'page-1' })}
 >
 {getInvestigationDisplayId(linkedInv)}
 </button>
 ) : (
 '-'
 )}
 </td>
 <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
 <Button size="sm" variant="outline" onClick={openRow}>
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

 <TabsContent value="investigations" className="mt-4 space-y-6">
 <section>
 <h3 className="text-sm font-semibold mb-2">Reported by this employee</h3>
 {renderInvestigationTable(
 investigationsReportedBy,
 'No investigations initiated from reports filed by this employee.'
 )}
 </section>
 <section>
 <h3 className="text-sm font-semibold mb-2">Reported against this employee</h3>
 {renderInvestigationTable(
 investigationsAgainst,
 'No investigations where this employee is the subject.'
 )}
 </section>
 <section>
 <h3 className="text-sm font-semibold mb-2">Employee witness</h3>
 {renderInvestigationTable(
 investigationsWitness,
 'No investigations where this employee is listed as a witness.'
 )}
 </section>
 </TabsContent>

 <TabsContent value="reports" className="mt-4">
 {employeeReports.length === 0 ? (
 <p className="text-sm text-[var(--color-text-secondary)]">
 No reports submitted for this employee yet. Any future incident reports, prompt escalations, or memo clarifications will appear here.
 </p>
 ) : (
 <div className="overflow-x-auto border border-[var(--color-border-200)]">
 <table className="w-full text-sm">
 <thead className="bg-[var(--color-surface-200)] text-[var(--color-text-secondary)]">
 <tr>
 <th className="px-3 py-2 text-left">Date</th>
 <th className="px-3 py-2 text-left">Case</th>
 <th className="px-3 py-2 text-left">Type</th>
 <th className="px-3 py-2 text-left">Check-in query</th>
 <th className="px-3 py-2 text-left">Category</th>
 <th className="px-3 py-2 text-left">Status</th>
 <th className="px-3 py-2 text-left">Severity</th>
 <th className="px-3 py-2 text-left">Investigation</th>
 <th className="px-3 py-2 text-left">Owner</th>
 <th className="px-3 py-2 text-left">Updated</th>
 <th className="px-3 py-2 text-right">Action</th>
 </tr>
 </thead>
 <tbody>
 {employeeReports.map((report) => {
 const owner = report.assignedTo ? dataStore.users.find((u) => u.id === report.assignedTo) : null;
 const inv = report.investigationId
 ? dataStore.investigations.find((i) => i.id === report.investigationId)
 : dataStore.investigations.find((i) => i.linkedReportIds.includes(report.id));
 const sourceResponse = report.sourcePromptResponseId
 ? dataStore.responses.find((r) => r.id === report.sourcePromptResponseId)
 : undefined;
 return (
 <tr
 key={report.id}
 className="border-t border-[var(--color-border-200)] hover:bg-[var(--color-surface-100)] cursor-pointer"
 onClick={() => onNavigate('report-detail', { id: report.id })}
 >
 <td className="px-3 py-2 whitespace-nowrap">{formatDate(report.createdAt)}</td>
 <td className="px-3 py-2 font-medium text-[var(--mismo-blue)]">{formatCaseReference(report)}</td>
 <td className="px-3 py-2">{report.sourcePromptId ? 'Prompt escalation' : 'Incident report'}</td>
 <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
 {sourceResponse ? (
 <button
 type="button"
 className="text-[var(--mismo-blue)] hover:underline"
 onClick={() => onNavigate('prompt-response-detail', { id: sourceResponse.id, type: sourceResponse.answer })}
 >
 {sourceResponse.answer === 'HAS_ISSUE' ? 'Yes' : 'No'}
 </button>
 ) : (
 '-'
 )}
 </td>
 <td className="px-3 py-2">{getCategoryLabel(report.category)}</td>
 <td className="px-3 py-2"><Badge className={getStatusColor(report.status)}>{report.status}</Badge></td>
 <td className="px-3 py-2">{report.severity}</td>
 <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
 {inv ? (
 <button
 type="button"
 className="text-[var(--mismo-blue)] hover:underline"
 onClick={() => onNavigate('investigation-detail', { id: inv.id, tab: 'page-1' })}
 >
 {getInvestigationDisplayId(inv)}
 </button>
 ) : (
 '-'
 )}
 </td>
 <td className="px-3 py-2">{owner ? `${owner.firstName} ${owner.lastName}` : 'Unassigned'}</td>
 <td className="px-3 py-2">{formatRelativeTime(report.updatedAt)}</td>
 <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
 <Button size="sm" variant="outline" onClick={() => onNavigate('report-detail', { id: report.id })}>View</Button>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </TabsContent>

 <TabsContent value="outreach" className="mt-4 space-y-4">
 <p className="text-sm text-[var(--color-text-secondary)]">
 Send reminders only with a clear reason. Messages are logged on this employee&apos;s record with channel, body, and sender.
 </p>
 <div className="flex flex-wrap gap-2">
 <Button variant="outline" size="sm" onClick={() => setReminderOpen(true)}>
 Send reminder…
 </Button>
 <Button variant="outline" size="sm" onClick={() => setManualOpen(true)}>
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
 </li>
 ))}
 </ul>
 )}
 </TabsContent>

 <TabsContent value="activity" className="mt-4">
 {activityTimeline.length === 0 ? (
 <p className="text-sm text-[var(--color-text-secondary)]">
 No activity recorded yet. Status changes, reminders, responses, and audit events will appear here.
 </p>
 ) : (
 <ul className="space-y-2">
 {activityTimeline.map((item) => {
 const meta = employeeActivities.find((a) => a.id === item.id)?.metadata as Record<string, unknown> | undefined;
 const deepLink = meta ? activityNavTarget(meta, dataStore) : undefined;
 return (
 <li key={item.id} className="border border-[var(--color-border-200)] p-3 rounded-[var(--radius-medium)] text-sm">
 <div className="flex flex-wrap justify-between gap-2 items-start">
 <span className="font-medium capitalize">{item.label}</span>
 <span className="text-xs text-[var(--color-text-muted)]">{formatRelativeTime(item.at)}</span>
 </div>
 {item.detail && <p className="text-xs text-[var(--color-text-muted)] mt-1">{item.detail}</p>}
 {deepLink && (
 <button
 type="button"
 className="text-xs text-[var(--mismo-blue)] hover:underline mt-2"
 onClick={() => onNavigate(deepLink.page, deepLink.params)}
 >
 Open {deepLink.label} →
 </button>
 )}
 </li>
 );
 })}
 </ul>
 )}
 </TabsContent>
 </Tabs>
 </CardContent>
 </Card>

 <OutreachReminderModal
 open={reminderOpen}
 onOpenChange={setReminderOpen}
 orgId={dataStore.currentUser.orgId}
 createdByUserId={dataStore.currentUser.id}
 employeeName={`${employee.firstName} ${employee.lastName}`}
 relatedLabel="Employee profile reminder"
 defaultSubject="HR reminder - action required"
 defaultBody="Please complete your pending HR check-ins and acknowledgements at your earliest convenience."
 onSend={(payload) => {
 const fullMessage = payload.internalNote
 ? `${payload.subject}\n\n${payload.body}\n\n[Internal: ${payload.internalNote}]`
 : `${payload.subject}\n\n${payload.body}`;
 payload.channels.forEach((ch) => {
 dataStore.sendNudge(employee.id, ch, fullMessage, {
 type: 'AT_RISK_OUTREACH',
 relatedLabel: payload.reason || 'Employee profile reminder',
 });
 });
 toast.success(`Reminder logged via ${payload.channels.join(' & ')}.`);
 }}
 />

 <ManualOutreachModal
 open={manualOpen}
 onOpenChange={setManualOpen}
 employeeName={`${employee.firstName} ${employee.lastName}`}
 relatedOptions={outreachRelatedOptions}
 onSave={(payload) => {
 const channel = payload.contactMethod === 'EMAIL' ? 'EMAIL' : payload.contactMethod === 'SMS' ? 'SMS' : 'MANUAL';
 const message = [payload.notes, payload.outcome && `Outcome: ${payload.outcome}`, payload.followUpDate && `Follow-up: ${payload.followUpDate}`]
 .filter(Boolean)
 .join('\n');
 const context: { type: 'MANUAL_OUTREACH'; relatedLabel?: string; reportId?: string; promptId?: string; policyId?: string } = {
 type: 'MANUAL_OUTREACH',
 relatedLabel: payload.relatedItem ?? 'Manual outreach',
 };
 if (payload.relatedItem?.startsWith('report:')) context.reportId = payload.relatedItem.slice(7);
 if (payload.relatedItem?.startsWith('prompt:')) context.promptId = payload.relatedItem.slice(7);
 if (payload.relatedItem?.startsWith('memo:')) context.policyId = payload.relatedItem.slice(5);
 dataStore.sendNudge(employee.id, channel, message, context);
 toast.success('Manual outreach logged.');
 }}
 />

 <EmployeeHistoryReportDialog
 open={reportOpen}
 onOpenChange={setReportOpen}
 employee={employee}
 engagement={engagement}
 promptRows={employeePromptRows}
 caseCount={employeeReports.length}
 openInvestigations={openInvestigationsCount}
 memoAckRate={memoAckRate}
 outreachCount={nudgesToEmployee.length}
 timeline={activityTimeline}
 onExportCsv={exportEmployeeReport}
 onOpenCheckInRegister={() => {
 setReportOpen(false);
 onNavigate('prompt-responses', { view: 'prompts', employeeId: employee.id, rangePreset: 'ALL', channel: 'incident' });
 }}
 onOpenProfileTab={(tab) => {
 setReportOpen(false);
 setHistoryTab(tab);
 }}
 />
 </div>
 );
}
