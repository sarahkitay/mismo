import { useMemo, useState } from 'react';
import type { DataStore } from '@/hooks/useDataStore';
import { Icons } from '@/lib/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import { formatRelativeTime, formatPercent, formatDate, getInitials } from '@/lib/utils';
import { compareByLastFirstName } from '@/lib/sortUsers';
import type { User, UserRole, UserStatus } from '@/types';
import { ASSIGNABLE_ROLES, roleLabel } from '@/lib/roleLabels';
import { inviteEmployeeToMismo } from '@/lib/api/employees';
import { toast } from 'sonner';

interface AdminEmployeesProps {
 dataStore: DataStore;
 onNavigate: (page: string, params?: Record<string, string>) => void;
 initialFilters?: Record<string, string>;
}

type DirectoryFilter = 'ALL' | 'AT_RISK' | 'NEVER_RESPONDED' | 'LOW_ENGAGEMENT';
type RecordStatusFilter = 'ACTIVE' | 'ARCHIVED' | 'ALL';
type ImportTab = 'DIRECTORY' | 'BULK_IMPORT';
type ConflictMode = 'SKIP' | 'UPDATE' | 'CREATE_NEW';
type MappingTemplate = { name: string; map: Record<string, string> };

const IMPORT_TEMPLATE_STORAGE = 'mismo_csv_mapping_templates';

function formatArchiveWindow(user: User): string {
 if (user.archiveStartDate || user.archiveEndDate) {
 const a = user.archiveStartDate ? formatDate(user.archiveStartDate) : '-';
 const b = user.archiveEndDate ? formatDate(user.archiveEndDate) : '-';
 return `${a} → ${b}`;
 }
 if (user.status === 'inactive') return 'Inactive (no archive dates)';
 return '-';
}

function displayEmployeeId(user: User): string {
 return user.employeeId?.trim() || '-';
}

export function AdminEmployees({ dataStore, onNavigate, initialFilters }: AdminEmployeesProps) {
  const { users, responses, atRiskEmployees, orgSettings, getEmployeeEngagement, createUsers, updateUser, departments } = dataStore;

 /** Prompt "I have an issue" / HAS_ISSUE: show corner badge; not for no-response / low-engagement alone */
 const userIdsWithReportedIssue = useMemo(() => {
 const ids = new Set<string>();
 for (const r of responses) {
 if (r.answer === 'HAS_ISSUE') ids.add(r.userId);
 }
 return ids;
 }, [responses]);
 const [recordStatusFilter, setRecordStatusFilter] = useState<RecordStatusFilter>('ACTIVE');
 const directoryUsers = users.filter((u) => {
 if (recordStatusFilter === 'ALL') return true;
 if (recordStatusFilter === 'ACTIVE') return u.status === 'active';
 return u.status === 'inactive';
 });

 const [activeTab, setActiveTab] = useState<ImportTab>(initialFilters?.import === 'csv' ? 'BULK_IMPORT' : 'DIRECTORY');
 const [filter, setFilter] = useState<DirectoryFilter>(initialFilters?.atRisk === 'true' ? 'AT_RISK' : 'ALL');
 const [searchQuery, setSearchQuery] = useState('');
 const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
 const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');

 const [editingUserId, setEditingUserId] = useState<string | null>(null);
 const editingUser = directoryUsers.find((u) => u.id === editingUserId) ?? null;
 const [editRole, setEditRole] = useState<UserRole>('EMPLOYEE');
 const [editDepartment, setEditDepartment] = useState('UNASSIGNED');
 const [editPhone, setEditPhone] = useState('');
 const [editEmployeeId, setEditEmployeeId] = useState('');
 const [editLocation, setEditLocation] = useState('');
 const [editArchiveStart, setEditArchiveStart] = useState('');
  const [editArchiveEnd, setEditArchiveEnd] = useState('');
  const [editStatus, setEditStatus] = useState<UserStatus>('active');
  const [editError, setEditError] = useState<string | null>(null);

 const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
 const [newFirstName, setNewFirstName] = useState('');
 const [newLastName, setNewLastName] = useState('');
 const [newEmail, setNewEmail] = useState('');
 const [newPhone, setNewPhone] = useState('');
 const [newEmployeeId, setNewEmployeeId] = useState('');
 const [newLocation, setNewLocation] = useState('');
 const [newDepartment, setNewDepartment] = useState('UNASSIGNED');
 const [newRole, setNewRole] = useState<UserRole>('EMPLOYEE');
 const [newStatus, setNewStatus] = useState<UserStatus>('active');
 const todayInput = () => new Date().toISOString().slice(0, 10);
 const [newHiredDate, setNewHiredDate] = useState(todayInput());
 const [addErrors, setAddErrors] = useState<{ firstName?: string; lastName?: string; email?: string }>({});
 const [inviteLink, setInviteLink] = useState<string | null>(null);
 const [inviteLinkName, setInviteLinkName] = useState('');
 const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

 const handleGenerateInviteLink = (employee: User) => {
 setInvitingUserId(employee.id);
 void inviteEmployeeToMismo(employee.email)
 .then((result) => {
 if (result.actionLink) {
 setInviteLinkName(`${employee.firstName} ${employee.lastName}`);
 setInviteLink(result.actionLink);
 } else {
 toast.info('No shareable link was returned.');
 }
 })
 .catch((err) => {
 toast.error(
 `Could not generate an invite link. ${err instanceof Error ? err.message : ''}`.trim()
 );
 })
 .finally(() => setInvitingUserId(null));
 };

 const copyInviteLink = async () => {
 if (!inviteLink) return;
 try {
 await navigator.clipboard.writeText(inviteLink);
 toast.success('Invite link copied to clipboard.');
 } catch {
 toast.error('Could not copy automatically. Select the link and copy it manually.');
 }
 };

 const clearAddError = (field: keyof typeof addErrors) => {
 setAddErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
 };

 const resetAddForm = () => {
 setNewFirstName('');
 setNewLastName('');
 setNewEmail('');
 setNewPhone('');
 setNewEmployeeId('');
 setNewLocation('');
 setNewDepartment('UNASSIGNED');
 setNewRole('EMPLOYEE');
 setNewStatus('active');
 setNewHiredDate(todayInput());
 setAddErrors({});
 };

 const [importHeaders, setImportHeaders] = useState<string[]>([]);
 const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
 const [fieldMap, setFieldMap] = useState<Record<string, string>>({
 firstName: '',
 lastName: '',
 email: '',
 phone: '',
 department: '',
 employeeId: '',
 location: '',
 archiveStart: '',
 archiveEnd: '',
 });
 const [conflictMode, setConflictMode] = useState<ConflictMode>('SKIP');
 const [mappingTemplateName, setMappingTemplateName] = useState('');
 const [selectedTemplate, setSelectedTemplate] = useState('');
 const [importSummary, setImportSummary] = useState<{ created: number; updated: number; errors: string[] } | null>(null);
 const [importedCount, setImportedCount] = useState(0);

 const templates = useMemo<MappingTemplate[]>(() => {
 try {
 const raw = localStorage.getItem(IMPORT_TEMPLATE_STORAGE);
 if (!raw) return [];
 return JSON.parse(raw) as MappingTemplate[];
 } catch {
 return [];
 }
 }, [importHeaders.length]);

 const atRiskIds = useMemo(() => new Set(atRiskEmployees.map((e) => e.userId)), [atRiskEmployees]);

 const showAtRiskOnly = () => {
 setFilter('AT_RISK');
 setActiveTab('DIRECTORY');
 setRecordStatusFilter('ACTIVE');
 window.setTimeout(() => {
 document.getElementById('employee-directory-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
 }, 50);
 };

 const filteredEmployees = directoryUsers
 .filter((emp) => {
 const matchesFilter =
 filter === 'ALL' ||
 (filter === 'AT_RISK' && atRiskIds.has(emp.id)) ||
 (filter === 'NEVER_RESPONDED' && !getEmployeeEngagement(emp.id)?.lastResponseAt) ||
 (filter === 'LOW_ENGAGEMENT' && (getEmployeeEngagement(emp.id)?.responseRate30d ?? 1) < orgSettings.thresholds.atRiskMinResponseRate);
 const q = searchQuery.toLowerCase();
 const matchesSearch =
 !searchQuery ||
 emp.firstName.toLowerCase().includes(q) ||
 emp.lastName.toLowerCase().includes(q) ||
 emp.email.toLowerCase().includes(q) ||
 (emp.employeeId?.toLowerCase().includes(q) ?? false) ||
 (emp.location?.toLowerCase().includes(q) ?? false) ||
 emp.id.toLowerCase().includes(q);
 const matchesDepartment = departmentFilter === 'ALL' || emp.departmentId === departmentFilter;
 const matchesRole = roleFilter === 'ALL' || emp.role === roleFilter;
 return matchesFilter && matchesSearch && matchesDepartment && matchesRole;
 })
 .sort(compareByLastFirstName);

 const getDepartmentName = (deptId?: string) => {
 if (!deptId) return 'Unassigned';
 return departments.find((d) => d.id === deptId)?.name || deptId;
 };

  const toDateInput = (d: Date | undefined) => {
 if (!d) return '';
 const date = d instanceof Date ? d : new Date(d);
 return date.toISOString().slice(0, 10);
 };

 const openEditUser = (userId: string) => {
 const user = directoryUsers.find((item) => item.id === userId);
 if (!user) return;
 setEditingUserId(user.id);
 setEditRole(user.role ?? 'EMPLOYEE');
 setEditDepartment(user.departmentId ?? 'UNASSIGNED');
 setEditPhone(user.phone ?? '');
 setEditEmployeeId(user.employeeId ?? '');
 setEditLocation(user.location ?? '');
    setEditArchiveStart(toDateInput(user.archiveStartDate));
    setEditArchiveEnd(toDateInput(user.archiveEndDate));
    setEditStatus(user.status);
    setEditError(null);
  };

 const saveUserEdits = () => {
 if (!editingUser) return;
 if (editArchiveStart && editArchiveEnd && new Date(editArchiveEnd) < new Date(editArchiveStart)) {
 setEditError('Archive end date cannot be before the start date.');
 return;
 }
 setEditError(null);
    updateUser(editingUser.id, {
      role: editRole,
      status: editStatus,
      departmentId: editDepartment === 'UNASSIGNED' ? undefined : editDepartment,
 phone: editPhone || undefined,
 employeeId: editEmployeeId.trim() || undefined,
 location: editLocation.trim() || undefined,
 archiveStartDate: editArchiveStart ? new Date(editArchiveStart) : undefined,
 archiveEndDate: editArchiveEnd ? new Date(editArchiveEnd) : undefined,
 });
 toast.success('Employee record updated.');
 setEditingUserId(null);
 };

 const handleAddEmployee = () => {
 const firstName = newFirstName.trim();
 const lastName = newLastName.trim();
 const email = newEmail.trim().toLowerCase();

 const errors: typeof addErrors = {};
 if (!firstName) errors.firstName = 'First name is required.';
 if (!lastName) errors.lastName = 'Last name is required.';
 if (!email) {
 errors.email = 'Email is required.';
 } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
 errors.email = 'Enter a valid email address.';
 } else if (users.some((u) => u.email.toLowerCase() === email)) {
 errors.email = 'An employee with this email already exists.';
 }

 if (errors.firstName || errors.lastName || errors.email) {
 setAddErrors(errors);
 return;
 }
 setAddErrors({});

 createUsers([
 {
 role: newRole,
 firstName,
 lastName,
 email,
 status: newStatus,
 phone: newPhone.trim() || undefined,
 employeeId: newEmployeeId.trim() || undefined,
 location: newLocation.trim() || undefined,
 departmentId: newDepartment === 'UNASSIGNED' ? undefined : newDepartment,
 hiredDate: newHiredDate ? new Date(newHiredDate) : new Date(),
 },
 ]);

 toast.success(`${firstName} ${lastName} added to the directory.`);
 resetAddForm();
 setIsAddDialogOpen(false);

 // Fire off the login invite (email + shareable link) without blocking the add.
 void inviteEmployeeToMismo(email)
 .then((result) => {
 if (result.actionLink) {
 setInviteLinkName(`${firstName} ${lastName}`);
 setInviteLink(result.actionLink);
 }
 if (result.status === 'already_registered') {
 toast.info(`${firstName} ${lastName} already has a login.`);
 } else {
 toast.success(`Invite email sent to ${email}.`);
 }
 })
 .catch((err) => {
 toast.error(
 `Employee added, but the invite could not be generated. ${err instanceof Error ? err.message : ''}`.trim()
 );
 });
 };

 const parseCsv = (csvText: string) => {
 const lines = csvText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
 if (lines.length < 2) return { headers: [], rows: [] };
 const headers = lines[0].split(',').map((h) => h.trim());
 const rows = lines.slice(1).map((line) => {
 const values = line.split(',').map((v) => v.trim());
 return headers.reduce((acc, header, idx) => {
 acc[header] = values[idx] ?? '';
 return acc;
 }, {} as Record<string, string>);
 });
 return { headers, rows };
 };

 const handleCsvUpload = async (file: File) => {
 const text = await file.text();
 const { headers, rows } = parseCsv(text);
 setImportHeaders(headers);
 setImportRows(rows);
 setImportSummary(null);
 setFieldMap({
 firstName: headers.find((h) => /first.?name/i.test(h)) ?? '',
 lastName: headers.find((h) => /last.?name/i.test(h)) ?? '',
 email: headers.find((h) => /email/i.test(h)) ?? '',
 phone: headers.find((h) => /phone|mobile/i.test(h)) ?? '',
 department: headers.find((h) => /department|dept/i.test(h)) ?? '',
 employeeId: headers.find((h) => /employee.?id|badge|payroll.?id/i.test(h)) ?? '',
 location: headers.find((h) => /location|site|office/i.test(h)) ?? '',
 archiveStart: headers.find((h) => /archive.?start|retention.?start/i.test(h)) ?? '',
 archiveEnd: headers.find((h) => /archive.?end|retention.?end/i.test(h)) ?? '',
 });
 };

 const saveTemplate = () => {
 if (!mappingTemplateName.trim()) {
 toast.error('Template name is required.');
 return;
 }
 const next = [...templates.filter((t) => t.name !== mappingTemplateName.trim()), { name: mappingTemplateName.trim(), map: fieldMap }];
 localStorage.setItem(IMPORT_TEMPLATE_STORAGE, JSON.stringify(next));
 setSelectedTemplate(mappingTemplateName.trim());
 toast.success('Mapping template saved.');
 };

 const applyTemplate = (name: string) => {
 setSelectedTemplate(name);
 const template = templates.find((t) => t.name === name);
 if (!template) return;
 setFieldMap(template.map);
 };

 const downloadErrorCsv = (errors: string[]) => {
 const csv = ['row,error', ...errors.map((e, idx) => `${idx + 1},"${e.replace(/"/g, '""')}"`)].join('\n');
 const blob = new Blob([csv], { type: 'text/csv' });
 const url = URL.createObjectURL(blob);
 const link = document.createElement('a');
 link.href = url;
 link.download = 'import-errors.csv';
 link.click();
 URL.revokeObjectURL(url);
 };

 const applyImport = () => {
 if (!fieldMap.firstName || !fieldMap.lastName || !fieldMap.email) {
 toast.error('Map first name, last name, and email before importing.');
 return;
 }
 let created = 0;
 let updated = 0;
 const errors: string[] = [];
 const batchToCreate: Array<{
 role: 'EMPLOYEE';
 firstName: string;
 lastName: string;
 email: string;
 phone?: string;
 departmentId?: string;
 status: 'active';
 employeeId?: string;
 location?: string;
 archiveStartDate?: Date;
 archiveEndDate?: Date;
 }> = [];

 const parseOptionalDate = (raw: string | undefined): Date | undefined => {
 if (!raw?.trim()) return undefined;
 const d = new Date(raw.trim());
 return Number.isNaN(d.getTime()) ? undefined : d;
 };

 importRows.forEach((row, index) => {
 const firstName = row[fieldMap.firstName] || '';
 const lastName = row[fieldMap.lastName] || '';
 const email = row[fieldMap.email] || '';
 const phone = row[fieldMap.phone] || undefined;
 const departmentId = departments.find((d) => d.name.toLowerCase() === (row[fieldMap.department] || '').toLowerCase())?.id;

 if (!firstName || !lastName || !email) {
 errors.push(`Row ${index + 1}: missing required field(s).`);
 return;
 }

 const employeeIdVal = fieldMap.employeeId ? (row[fieldMap.employeeId] || '').trim() : undefined;
 const locationVal = fieldMap.location ? (row[fieldMap.location] || '').trim() : undefined;
 const archiveStartVal = fieldMap.archiveStart ? parseOptionalDate(row[fieldMap.archiveStart]) : undefined;
 const archiveEndVal = fieldMap.archiveEnd ? parseOptionalDate(row[fieldMap.archiveEnd]) : undefined;

 const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
 if (!existing) {
 batchToCreate.push({
 role: 'EMPLOYEE',
 firstName,
 lastName,
 email,
 phone,
 departmentId,
 status: 'active',
 ...(employeeIdVal ? { employeeId: employeeIdVal } : {}),
 ...(locationVal ? { location: locationVal } : {}),
 ...(archiveStartVal ? { archiveStartDate: archiveStartVal } : {}),
 ...(archiveEndVal ? { archiveEndDate: archiveEndVal } : {}),
 });
 created += 1;
 return;
 }

 if (conflictMode === 'SKIP') return;
 if (conflictMode === 'UPDATE') {
 updateUser(existing.id, {
 firstName,
 lastName,
 phone,
 departmentId,
 ...(employeeIdVal ? { employeeId: employeeIdVal } : {}),
 ...(locationVal ? { location: locationVal } : {}),
 ...(archiveStartVal ? { archiveStartDate: archiveStartVal } : {}),
 ...(archiveEndVal ? { archiveEndDate: archiveEndVal } : {}),
 });
 updated += 1;
 return;
 }

 batchToCreate.push({
 role: 'EMPLOYEE',
 firstName,
 lastName,
 email: `${email.split('@')[0]}+dup${Date.now()}@${email.split('@')[1] ?? 'example.com'}`,
 phone,
 departmentId,
 status: 'active',
 ...(employeeIdVal ? { employeeId: `${employeeIdVal}-dup` } : {}),
 ...(locationVal ? { location: locationVal } : {}),
 });
 created += 1;
 });

 if (batchToCreate.length > 0) createUsers(batchToCreate);
 setImportedCount((prev) => prev + created + updated);
 setImportSummary({ created, updated, errors });
 toast.success('Bulk import completed.');
 };

 return (
 <div className="space-y-6">
 <div className="employees-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div>
 <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Employees</h1>
 <p className="text-[var(--mismo-text-secondary)] mt-1">
 Add employees one at a time or use bulk import for CSV onboarding
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 <Button
 className="bg-[var(--mismo-blue)] hover:bg-blue-600"
 onClick={() => {
 resetAddForm();
 setIsAddDialogOpen(true);
 }}
 >
 <Icons.add className="h-4 w-4 mr-2" />
 Add employee
 </Button>
 <span className="text-sm text-[var(--mismo-text-secondary)]">
 {filteredEmployees.length} shown {importedCount > 0 ? `(+${importedCount} imported)` : ''}
 </span>
 </div>
 </div>

 <div className="flex items-center gap-2 border-b border-[var(--color-border-200)] pb-3">
 <Button variant={activeTab === 'DIRECTORY' ? 'default' : 'outline'} onClick={() => setActiveTab('DIRECTORY')}>
 Directory
 </Button>
 <Button variant={activeTab === 'BULK_IMPORT' ? 'default' : 'outline'} onClick={() => setActiveTab('BULK_IMPORT')}>
 Bulk Import
 </Button>
 </div>

 {activeTab === 'DIRECTORY' && (
 <>
 {recordStatusFilter === 'ACTIVE' && atRiskEmployees.length > 0 && (
 <Card
 className="mismo-card border-l-4 border-l-[var(--color-alert-600)] cursor-pointer hover:bg-[var(--color-surface-200)] transition-colors"
 role="button"
 tabIndex={0}
 onClick={showAtRiskOnly}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 showAtRiskOnly();
 }
 }}
 >
 <CardContent className="p-4 flex items-center justify-between gap-4">
 <div>
 <p className="font-medium text-[var(--mismo-text)]">{atRiskEmployees.length} employees at risk</p>
 <p className="text-sm text-[var(--mismo-text-secondary)]">Low engagement or no recent responses - click to filter directory</p>
 </div>
 <Button
 variant="outline"
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 showAtRiskOnly();
 }}
 >
 View at-risk
 </Button>
 </CardContent>
 </Card>
 )}

 <div className="flex flex-col lg:flex-row gap-4">
 <div className="relative flex-1">
 <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
 <Input placeholder="Search by name, email, employee ID, location…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
 </div>
 <div className="flex flex-wrap gap-2">
 <Select value={recordStatusFilter} onValueChange={(v) => setRecordStatusFilter(v as RecordStatusFilter)}>
 <SelectTrigger className="w-[160px]"><SelectValue placeholder="Record" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="ACTIVE">Active roster</SelectItem>
 <SelectItem value="ARCHIVED">Archived / inactive</SelectItem>
 <SelectItem value="ALL">Everyone</SelectItem>
 </SelectContent>
 </Select>
 <Select value={filter} onValueChange={(v) => setFilter(v as DirectoryFilter)}>
 <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="ALL">All (engagement)</SelectItem>
 <SelectItem value="AT_RISK">At-Risk Only</SelectItem>
 <SelectItem value="NEVER_RESPONDED">Never Responded</SelectItem>
 <SelectItem value="LOW_ENGAGEMENT">Low Engagement</SelectItem>
 </SelectContent>
 </Select>
 <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
 <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="ALL">All Departments</SelectItem>
 {departments.map((dept) => (
 <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
 <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="ALL">All Roles</SelectItem>
 {ASSIGNABLE_ROLES.map((role) => (
 <SelectItem key={role} value={role}>
 {roleLabel(role)}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 <div id="employee-directory-list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
 {filteredEmployees.map((employee) => {
 const engagement = getEmployeeEngagement(employee.id);
 const reportedIssueViaPrompt = userIdsWithReportedIssue.has(employee.id);
 return (
 <Card
 key={employee.id}
 className={`employee-card mismo-card relative ${reportedIssueViaPrompt ? 'border-[var(--color-alert-600)]' : ''}`}
 >
 <CardContent className="p-5">
 <div className="absolute top-3 right-3 flex items-center gap-1.5">
 {reportedIssueViaPrompt && (
 <Badge className="status-chip status-chip--alert">At Risk</Badge>
 )}
 <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${employee.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
 {employee.status === 'active' ? 'Active' : 'Inactive'}
 </span>
 </div>
 <div className="flex items-start gap-4">
 <div className="w-12 h-12 rounded-full bg-[var(--mismo-blue-light)] flex items-center justify-center">
 <span className="text-lg font-semibold text-[var(--mismo-blue)]">{getInitials(employee.firstName, employee.lastName)}</span>
 </div>
 <div className="flex-1 min-w-0 pr-16">
 <div className="flex items-center gap-2">
 <h3 className="font-semibold text-[var(--mismo-text)] truncate">{employee.firstName} {employee.lastName}</h3>
 </div>
 <p className="text-sm text-[var(--mismo-text-secondary)] truncate">{employee.email}</p>
 <p className="text-sm text-[var(--mismo-text-secondary)]">{getDepartmentName(employee.departmentId)}</p>
 <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">
 Role: {roleLabel(employee.role)}
 </p>
 </div>
 </div>

 <div className="mt-3 space-y-1 text-xs text-[var(--mismo-text-secondary)]">
 <p>
 <span className="font-medium text-[var(--mismo-text)]">Employee ID:</span> {displayEmployeeId(employee)}
 </p>
 <p>
 <span className="font-medium text-[var(--mismo-text)]">Location:</span> {employee.location?.trim() || '-'}
 </p>
 <p>
 <span className="font-medium text-[var(--mismo-text)]">Archive:</span> {formatArchiveWindow(employee)}
 </p>
 <p className="text-[10px] text-[var(--mismo-text-secondary)] opacity-80">System record: {employee.id}</p>
 </div>

 <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
 <div>
 <p className="text-xs text-[var(--mismo-text-secondary)] uppercase">Response Rate</p>
 <p className="font-semibold text-[var(--mismo-text)]">{engagement ? formatPercent(engagement.responseRate30d) : 'N/A'}</p>
 </div>
 <div>
 <p className="text-xs text-[var(--mismo-text-secondary)] uppercase">Last Response</p>
 <p className="font-semibold text-[var(--mismo-text)]">
 {engagement?.lastResponseAt ? formatRelativeTime(engagement.lastResponseAt) : 'Never'}
 </p>
 </div>
 </div>

 <div className="flex flex-wrap gap-2 mt-4">
 <Button variant="default" size="sm" onClick={() => onNavigate('employee-detail', { id: employee.id })}>
 View chart
 </Button>
                    <Button variant="outline" size="sm" onClick={() => openEditUser(employee.id)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleGenerateInviteLink(employee)}
                      disabled={invitingUserId === employee.id}
                    >
                      {invitingUserId === employee.id ? 'Generating…' : 'Invite link'}
                    </Button>
                  </div>
 </CardContent>
 </Card>
 );
 })}
 </div>
 </>
 )}

 {activeTab === 'BULK_IMPORT' && (
 <Card className="mismo-card">
 <CardContent className="p-6 space-y-5">
 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
 <div>
 <h2 className="mismo-heading text-2xl text-[var(--color-primary-900)]">Bulk Import</h2>
 <p className="text-sm text-[var(--mismo-text-secondary)] mt-1">
 Upload a CSV to onboard many employees at once. For a single hire, use Add employee on the Directory tab.
 </p>
 </div>
 <Button variant="outline" onClick={() => setActiveTab('DIRECTORY')}>
 Add one employee
 </Button>
 </div>
 <div className="space-y-2">
 <Label>Step 1: Upload CSV</Label>
 <Input type="file" accept=".csv,text/csv" onChange={(e) => {
 const file = e.target.files?.[0];
 if (file) void handleCsvUpload(file);
 }} />
 </div>

 {importHeaders.length > 0 && (
 <>
 <div className="space-y-3">
 <Label>Step 2: Field Mapping</Label>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {(
 [
 'firstName',
 'lastName',
 'email',
 'phone',
 'department',
 'employeeId',
 'location',
 'archiveStart',
 'archiveEnd',
 ] as const
 ).map((key) => (
 <div key={key} className="space-y-1.5">
 <Label>
 {key === 'employeeId'
 ? 'Employee ID (optional)'
 : key === 'firstName'
 ? 'First name'
 : key === 'lastName'
 ? 'Last name'
 : key === 'location'
 ? 'Location (optional)'
 : key === 'archiveStart'
 ? 'Archive start (optional)'
 : key === 'archiveEnd'
 ? 'Archive end (optional)'
 : key}
 </Label>
 <Select value={fieldMap[key] ?? ''} onValueChange={(v) => setFieldMap((prev) => ({ ...prev, [key]: v }))}>
 <SelectTrigger><SelectValue placeholder="Select CSV column" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="">(None)</SelectItem>
 {importHeaders.map((header) => (
 <SelectItem key={header} value={header}>{header}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 ))}
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
 <Input placeholder="Template name" value={mappingTemplateName} onChange={(e) => setMappingTemplateName(e.target.value)} />
 <Button variant="outline" onClick={saveTemplate}>Save Mapping Template</Button>
 </div>

 <div className="space-y-1.5">
 <Label>Reuse Template</Label>
 <Select value={selectedTemplate} onValueChange={applyTemplate}>
 <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
 <SelectContent>
 {templates.map((template) => (
 <SelectItem key={template.name} value={template.name}>{template.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-1.5">
 <Label>Conflict Resolution</Label>
 <Select value={conflictMode} onValueChange={(v) => setConflictMode(v as ConflictMode)}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="SKIP">Skip</SelectItem>
 <SelectItem value="UPDATE">Update</SelectItem>
 <SelectItem value="CREATE_NEW">Create New</SelectItem>
 </SelectContent>
 </Select>
 </div>

 <div className="space-y-2">
 <Label>Validation Preview</Label>
 <div className="border border-[var(--color-border-200)] overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-[var(--color-surface-200)]">
 <tr>
 <th className="px-3 py-2 text-left">First Name</th>
 <th className="px-3 py-2 text-left">Last Name</th>
 <th className="px-3 py-2 text-left">Email</th>
 <th className="px-3 py-2 text-left">Department</th>
 <th className="px-3 py-2 text-left">Employee ID</th>
 <th className="px-3 py-2 text-left">Location</th>
 </tr>
 </thead>
 <tbody>
 {importRows.slice(0, 5).map((row, idx) => (
 <tr key={idx} className="border-t border-[var(--color-border-200)]">
 <td className="px-3 py-2">{row[fieldMap.firstName] ?? ''}</td>
 <td className="px-3 py-2">{row[fieldMap.lastName] ?? ''}</td>
 <td className="px-3 py-2">{row[fieldMap.email] ?? ''}</td>
 <td className="px-3 py-2">{row[fieldMap.department] ?? ''}</td>
 <td className="px-3 py-2">{fieldMap.employeeId ? (row[fieldMap.employeeId] ?? '') : '-'}</td>
 <td className="px-3 py-2">{fieldMap.location ? (row[fieldMap.location] ?? '') : '-'}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 <Button onClick={applyImport}>Run Import</Button>
 </>
 )}

 {importSummary && (
 <Card className="border border-[var(--color-border-200)] bg-[var(--color-surface-100)]">
 <CardContent className="p-4 space-y-2">
 <p className="font-semibold text-[var(--color-text-primary)]">Import Summary</p>
 <p className="text-sm text-[var(--color-text-secondary)]">Records created: {importSummary.created}</p>
 <p className="text-sm text-[var(--color-text-secondary)]">Records updated: {importSummary.updated}</p>
 <p className="text-sm text-[var(--color-text-secondary)]">Errors: {importSummary.errors.length}</p>
 {importSummary.errors.length > 0 && (
 <Button variant="outline" onClick={() => downloadErrorCsv(importSummary.errors)}>
 Download Error Report CSV
 </Button>
 )}
 </CardContent>
 </Card>
 )}
 </CardContent>
 </Card>
 )}

 <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
 setIsAddDialogOpen(open);
 if (!open) resetAddForm();
 }}>
 <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>Add employee</DialogTitle>
 </DialogHeader>
 <div className="space-y-3">
 <p className="text-xs text-[var(--color-text-secondary)]">
 Creates a directory record immediately. Use bulk import for large CSV uploads.
 </p>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <Label>First name</Label>
 <Input
 value={newFirstName}
 onChange={(e) => { setNewFirstName(e.target.value); clearAddError('firstName'); }}
 placeholder="Alex"
 aria-invalid={!!addErrors.firstName}
 className={addErrors.firstName ? 'border-[var(--color-alert-600)] focus-visible:ring-[var(--color-alert-600)]' : undefined}
 />
 {addErrors.firstName && (
 <p className="text-xs text-[var(--color-alert-600)]">{addErrors.firstName}</p>
 )}
 </div>
 <div className="space-y-1.5">
 <Label>Last name</Label>
 <Input
 value={newLastName}
 onChange={(e) => { setNewLastName(e.target.value); clearAddError('lastName'); }}
 placeholder="Morgan"
 aria-invalid={!!addErrors.lastName}
 className={addErrors.lastName ? 'border-[var(--color-alert-600)] focus-visible:ring-[var(--color-alert-600)]' : undefined}
 />
 {addErrors.lastName && (
 <p className="text-xs text-[var(--color-alert-600)]">{addErrors.lastName}</p>
 )}
 </div>
 </div>
 <div className="space-y-1.5">
 <Label>Email</Label>
 <Input
 type="email"
 value={newEmail}
 onChange={(e) => { setNewEmail(e.target.value); clearAddError('email'); }}
 placeholder="alex.morgan@company.com"
 aria-invalid={!!addErrors.email}
 className={addErrors.email ? 'border-[var(--color-alert-600)] focus-visible:ring-[var(--color-alert-600)]' : undefined}
 />
 {addErrors.email && (
 <p className="text-xs text-[var(--color-alert-600)]">{addErrors.email}</p>
 )}
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <Label>Employee ID (optional)</Label>
 <Input value={newEmployeeId} onChange={(e) => setNewEmployeeId(e.target.value)} placeholder="EMP-1003" />
 </div>
 <div className="space-y-1.5">
 <Label>Phone (optional)</Label>
 <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1-555-0100" />
 </div>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <Label>Location (optional)</Label>
 <Input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="San Francisco HQ" />
 </div>
 <div className="space-y-1.5">
 <Label>Date started</Label>
 <Input type="date" value={newHiredDate} onChange={(e) => setNewHiredDate(e.target.value)} />
 <p className="text-xs text-[var(--color-text-secondary)]">Defaults to today if left blank.</p>
 </div>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <Label>Role</Label>
 <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {ASSIGNABLE_ROLES.map((role) => (
 <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-1.5">
 <Label>Department</Label>
 <Select value={newDepartment} onValueChange={setNewDepartment}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
 {departments.map((dept) => (
 <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 <div className="space-y-1.5">
 <Label>Employment status</Label>
 <Select value={newStatus} onValueChange={(v) => setNewStatus(v as UserStatus)}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="active">Active</SelectItem>
 <SelectItem value="inactive">Inactive</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="flex justify-end gap-2 pt-2">
 <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
 <Button type="button" onClick={handleAddEmployee}>Add employee</Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>

 <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) { setEditingUserId(null); setEditError(null); } }}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Edit employee</DialogTitle>
 </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Optional fields (location, employee ID, phone, archive dates) can be cleared by emptying them and saving.
            Check-in and case history is never deleted from this screen.
          </p>
          <div className="space-y-1.5">
 <Label>Employee ID</Label>
 <Input value={editEmployeeId} onChange={(e) => setEditEmployeeId(e.target.value)} placeholder="Company / badge number" />
 </div>
 <div className="space-y-1.5">
 <Label>Location</Label>
 <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Office, site, or region" />
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <Label>Archive start</Label>
 <Input type="date" value={editArchiveStart} onChange={(e) => { setEditArchiveStart(e.target.value); setEditError(null); }} />
 </div>
 <div className="space-y-1.5">
 <Label>Archive end</Label>
 <Input
 type="date"
 value={editArchiveEnd}
 onChange={(e) => { setEditArchiveEnd(e.target.value); setEditError(null); }}
 aria-invalid={!!editError}
 className={editError ? 'border-[var(--color-alert-600)] focus-visible:ring-[var(--color-alert-600)]' : undefined}
 />
 </div>
 </div>
 {editError && (
 <p className="text-xs text-[var(--color-alert-600)]">{editError}</p>
 )}
          <div className="space-y-1.5">
            <Label>Employment status</Label>
            <Select value={editStatus} onValueChange={(v) => setEditStatus(v as UserStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
 <Select value={editRole} onValueChange={(v) => setEditRole(v as UserRole)}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {ASSIGNABLE_ROLES.map((role) => (
 <SelectItem key={role} value={role}>
 {roleLabel(role)}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-1.5">
 <Label>Department</Label>
 <Select value={editDepartment} onValueChange={setEditDepartment}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
 {departments.map((dept) => (
 <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-1.5">
 <Label>Phone</Label>
 <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
 </div>
 <div className="flex justify-end">
 <Button type="button" onClick={saveUserEdits}>Save Changes</Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>

 <Dialog open={!!inviteLink} onOpenChange={(open) => { if (!open) setInviteLink(null); }}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Invite link for {inviteLinkName}</DialogTitle>
 </DialogHeader>
 <div className="space-y-3">
 <p className="text-sm text-[var(--color-text-secondary)]">
 Share this link so they can set up their Mismo login. If email delivery is configured, an
 invite email was also sent automatically.
 </p>
 <div className="flex gap-2">
 <Input
 readOnly
 value={inviteLink ?? ''}
 onFocus={(e) => e.currentTarget.select()}
 className="font-mono text-xs"
 />
 <Button type="button" onClick={copyInviteLink}>Copy</Button>
 </div>
 <p className="text-xs text-[var(--color-text-secondary)]">
 This link is single use and expires. If it stops working, resend the invite to generate a new one.
 </p>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
}
