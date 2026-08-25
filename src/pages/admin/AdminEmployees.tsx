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
import { formatRelativeTime, formatPercent, getInitials } from '@/lib/utils';
import { compareByLastFirstName } from '@/lib/sortUsers';
import type { User, UserRole, UserStatus } from '@/types';
import { ASSIGNABLE_ROLES, roleLabel } from '@/lib/roleLabels';
import { inviteEmployeeToMismo } from '@/lib/api/employees';
import { sanitizeInfraError } from '@/lib/infraMessaging';
import { toast } from 'sonner';
import { PageMoreInfo } from '@/components/PageMoreInfo';
import {
  CUSTOM_ROLE_PREFIX,
  displayEmployeeId,
  displayRole,
  formatArchiveWindow,
  parseRoleSelect,
  roleSelectValue,
} from '@/lib/employeeDirectory';
import {
  parseEmployeeCsv,
  planEmployeeCsvImport,
  suggestEmployeeCsvFieldMap,
  type EmployeeCsvFieldMap,
} from '@/lib/employeeCsvImport';

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
const STANDARD_DEPARTMENTS = ['Human Resources', 'Operations', 'Finance', 'Sales', 'Marketing', 'Information Technology', 'Legal'];

export function AdminEmployees({ dataStore, onNavigate, initialFilters }: AdminEmployeesProps) {
  const {
    users,
    responses,
    atRiskEmployees,
    orgSettings,
    getEmployeeEngagement,
    createUsers,
    updateUser,
    departments,
    createDepartment,
    addCustomRole,
  } = dataStore;

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

 const clearDirectoryFilters = () => {
 setSearchQuery('');
 setRecordStatusFilter('ACTIVE');
 setFilter('ALL');
 setDepartmentFilter('ALL');
 setRoleFilter('ALL');
 setActiveTab('DIRECTORY');
 };

 const [editingUserId, setEditingUserId] = useState<string | null>(null);
 const editingUser = directoryUsers.find((u) => u.id === editingUserId) ?? null;
 const [editRole, setEditRole] = useState<UserRole>('EMPLOYEE');
 const [editJobTitle, setEditJobTitle] = useState<string | undefined>(undefined);
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
 const [newJobTitle, setNewJobTitle] = useState<string | undefined>(undefined);
 const [newStatus, setNewStatus] = useState<UserStatus>('active');
 const todayInput = () => new Date().toISOString().slice(0, 10);
 const [newHiredDate, setNewHiredDate] = useState(todayInput());
 const [addErrors, setAddErrors] = useState<{ firstName?: string; lastName?: string; email?: string }>({});
 const [inviteLink, setInviteLink] = useState<string | null>(null);
 const [inviteLinkName, setInviteLinkName] = useState('');
 const [inviteEmail, setInviteEmail] = useState<string | null>(null);
 const [inviteEmailing, setInviteEmailing] = useState(false);
 const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

 /** Quick-add dialogs for Role / Department on employee forms */
 const [quickAddTarget, setQuickAddTarget] = useState<'add' | 'edit' | null>(null);
 const [quickAddKind, setQuickAddKind] = useState<'role' | 'department' | null>(null);
 const [quickAddName, setQuickAddName] = useState('');
 const [quickAddError, setQuickAddError] = useState<string | null>(null);

 const customRoles = orgSettings.customRoles ?? [];

 const openQuickAdd = (kind: 'role' | 'department', target: 'add' | 'edit') => {
   setQuickAddKind(kind);
   setQuickAddTarget(target);
   setQuickAddName('');
   setQuickAddError(null);
 };

 const closeQuickAdd = () => {
   setQuickAddKind(null);
   setQuickAddTarget(null);
   setQuickAddName('');
   setQuickAddError(null);
 };

 const submitQuickAdd = () => {
   if (!quickAddKind || !quickAddTarget) return;
   if (quickAddKind === 'department') {
     const result = createDepartment(quickAddName);
     if ('error' in result) {
       setQuickAddError(result.error);
       return;
     }
     if (quickAddTarget === 'add') setNewDepartment(result.id);
     else setEditDepartment(result.id);
     toast.success(`Department "${result.name}" added.`);
     closeQuickAdd();
     return;
   }
   const result = addCustomRole(quickAddName);
   if (typeof result !== 'string') {
     setQuickAddError(result.error);
     return;
   }
   if (quickAddTarget === 'add') {
     setNewRole('EMPLOYEE');
     setNewJobTitle(result);
   } else {
     setEditRole('EMPLOYEE');
     setEditJobTitle(result);
   }
   toast.success(`Role "${result}" added.`);
   closeQuickAdd();
 };

 const handleGenerateInviteLink = (employee: User) => {
 setInvitingUserId(employee.id);
 void inviteEmployeeToMismo(employee.email, { sendEmail: false })
 .then((result) => {
 if (result.actionLink) {
 setInviteLinkName(`${employee.firstName} ${employee.lastName}`);
 setInviteEmail(employee.email);
 setInviteLink(result.actionLink);
 toast.success('Sign-in link ready — email it or copy it below.');
 } else {
 toast.info(result.message || 'No shareable link was returned.');
 }
 })
 .catch((err) => {
 toast.error(
 `Could not generate an invite link. ${sanitizeInfraError(err instanceof Error ? err.message : '')}`.trim()
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

 const emailInviteLink = () => {
 if (!inviteEmail) return;
 setInviteEmailing(true);
 void inviteEmployeeToMismo(inviteEmail, { sendEmail: true })
 .then((result) => {
 if (result.actionLink) setInviteLink(result.actionLink);
 toast.success(result.message || 'Invite email sent.');
 })
 .catch((err) => {
 toast.error(sanitizeInfraError(err instanceof Error ? err.message : 'Could not email invite.'));
 })
 .finally(() => setInviteEmailing(false));
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
 setNewJobTitle(undefined);
 setNewStatus('active');
 setNewHiredDate(todayInput());
 setAddErrors({});
 };

 const [importHeaders, setImportHeaders] = useState<string[]>([]);
 const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
 const [fieldMap, setFieldMap] = useState<EmployeeCsvFieldMap>({
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
 setEditJobTitle(user.jobTitle);
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
      jobTitle: editJobTitle,
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
 jobTitle: newJobTitle,
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

 // Offer email vs copy for the new employee's sign-in link.
 void inviteEmployeeToMismo(email, { sendEmail: false })
 .then((result) => {
 if (result.actionLink) {
 setInviteLinkName(`${firstName} ${lastName}`);
 setInviteEmail(email);
 setInviteLink(result.actionLink);
 }
 toast.success('Employee added. Email or copy their sign-in link.');
 })
 .catch((err) => {
 toast.error(
 `Employee added, but the invite could not be generated. ${sanitizeInfraError(err instanceof Error ? err.message : '')}`.trim()
 );
 });
 };

 const handleCsvUpload = async (file: File) => {
 const text = await file.text();
 const { headers, rows } = parseEmployeeCsv(text);
 setImportHeaders(headers);
 setImportRows(rows);
 setImportSummary(null);
 setFieldMap(suggestEmployeeCsvFieldMap(headers));
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
 setFieldMap({
   firstName: template.map.firstName ?? '',
   lastName: template.map.lastName ?? '',
   email: template.map.email ?? '',
   phone: template.map.phone ?? '',
   department: template.map.department ?? '',
   employeeId: template.map.employeeId ?? '',
   location: template.map.location ?? '',
   archiveStart: template.map.archiveStart ?? '',
   archiveEnd: template.map.archiveEnd ?? '',
 });
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
 const planned = planEmployeeCsvImport({
 rows: importRows,
 fieldMap,
 conflictMode,
 departments,
 users,
 });
 planned.updates.forEach((u) => updateUser(u.id, u));
 if (planned.batchToCreate.length > 0) createUsers(planned.batchToCreate);
 setImportedCount((prev) => prev + planned.created + planned.updated);
 setImportSummary({ created: planned.created, updated: planned.updated, errors: planned.errors });
 toast.success('Bulk import completed.');
 };

 return (
 <div className="space-y-6">
 <div className="employees-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
 <div>
 <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Employees</h1>
 <PageMoreInfo>Add employees one at a time or use bulk import for CSV onboarding</PageMoreInfo>
 </div>
 <div className="flex flex-wrap items-center gap-2">
 {departments.length === 0 && (
 <Button
 variant="outline"
 onClick={() => {
 STANDARD_DEPARTMENTS.forEach((name) => createDepartment(name));
 toast.success('Standard departments added. You can edit them or add more in Settings.');
 }}
 >
 Add standard departments
 </Button>
 )}
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
 <Button variant={activeTab === 'DIRECTORY' ? 'default' : 'outline'} onClick={clearDirectoryFilters}>
 Directory
 </Button>
 <Button variant={activeTab === 'BULK_IMPORT' ? 'default' : 'outline'} onClick={() => setActiveTab('BULK_IMPORT')}>
 Bulk Import
 </Button>
 </div>
 {(searchQuery || recordStatusFilter !== 'ACTIVE' || filter !== 'ALL' || departmentFilter !== 'ALL' || roleFilter !== 'ALL') && (
 <div className="flex items-center justify-between gap-3 rounded border border-[var(--color-border-200)] bg-[var(--color-surface-100)] px-3 py-2">
 <p className="text-sm text-[var(--color-text-secondary)]">Directory filters are active · {filteredEmployees.length} employee(s) shown</p>
 <Button type="button" variant="outline" size="sm" onClick={clearDirectoryFilters}>Clear search &amp; filters</Button>
 </div>
 )}

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
 Role: {displayRole(employee)}
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
                      {invitingUserId === employee.id
                        ? 'Generating…'
                        : employee.authUserId
                          ? 'Sign-in link'
                          : 'Invite / sign-in'}
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
 <div className="flex items-center justify-between gap-2">
 <Label>Role</Label>
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="h-7 px-2 text-xs"
 onClick={() => openQuickAdd('role', 'add')}
 >
 <Icons.add className="size-3.5" />
 Add role
 </Button>
 </div>
 <Select
 value={roleSelectValue(newRole, newJobTitle)}
 onValueChange={(v) => {
 const parsed = parseRoleSelect(v);
 setNewRole(parsed.role);
 setNewJobTitle(parsed.jobTitle);
 }}
 >
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {ASSIGNABLE_ROLES.map((role) => (
 <SelectItem key={role} value={role}>{roleLabel(role)}</SelectItem>
 ))}
 {customRoles.map((title) => (
 <SelectItem key={`custom-${title}`} value={`${CUSTOM_ROLE_PREFIX}${title}`}>
 {title}
 </SelectItem>
 ))}
 {newJobTitle && !customRoles.includes(newJobTitle) && (
 <SelectItem value={`${CUSTOM_ROLE_PREFIX}${newJobTitle}`}>{newJobTitle}</SelectItem>
 )}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-1.5">
 <div className="flex items-center justify-between gap-2">
 <Label>Department</Label>
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="h-7 px-2 text-xs"
 onClick={() => openQuickAdd('department', 'add')}
 >
 <Icons.add className="size-3.5" />
 Add department
 </Button>
 </div>
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
            <div className="flex items-center justify-between gap-2">
              <Label>Role</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => openQuickAdd('role', 'edit')}
              >
                <Icons.add className="size-3.5" />
                Add role
              </Button>
            </div>
 <Select
 value={roleSelectValue(editRole, editJobTitle)}
 onValueChange={(v) => {
 const parsed = parseRoleSelect(v);
 setEditRole(parsed.role);
 setEditJobTitle(parsed.jobTitle);
 }}
 >
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {ASSIGNABLE_ROLES.map((role) => (
 <SelectItem key={role} value={role}>
 {roleLabel(role)}
 </SelectItem>
 ))}
 {customRoles.map((title) => (
 <SelectItem key={`edit-custom-${title}`} value={`${CUSTOM_ROLE_PREFIX}${title}`}>
 {title}
 </SelectItem>
 ))}
 {editJobTitle && !customRoles.includes(editJobTitle) && (
 <SelectItem value={`${CUSTOM_ROLE_PREFIX}${editJobTitle}`}>{editJobTitle}</SelectItem>
 )}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-1.5">
 <div className="flex items-center justify-between gap-2">
 <Label>Department</Label>
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="h-7 px-2 text-xs"
 onClick={() => openQuickAdd('department', 'edit')}
 >
 <Icons.add className="size-3.5" />
 Add department
 </Button>
 </div>
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

 <Dialog
 open={!!inviteLink}
 onOpenChange={(open) => {
 if (!open) {
 setInviteLink(null);
 setInviteEmail(null);
 }
 }}
 >
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Sign-in link for {inviteLinkName}</DialogTitle>
 </DialogHeader>
 <div className="space-y-3">
 <p className="text-sm text-[var(--color-text-secondary)]">
 Choose how to share this link so they can set up or open their Mismo login.
 </p>
 <div className="flex flex-wrap gap-2">
 <Button type="button" onClick={emailInviteLink} disabled={inviteEmailing || !inviteEmail}>
 {inviteEmailing ? 'Sending…' : 'Email to employee'}
 </Button>
 <Button type="button" variant="outline" onClick={copyInviteLink}>
 Copy link
 </Button>
 </div>
 <div className="flex gap-2">
 <Input
 readOnly
 value={inviteLink ?? ''}
 onFocus={(e) => e.currentTarget.select()}
 className="font-mono text-xs"
 />
 </div>
 {inviteEmail && (
 <p className="text-xs text-[var(--color-text-secondary)]">
 Email will go to <span className="font-medium text-[var(--mismo-text)]">{inviteEmail}</span>.
 </p>
 )}
 <p className="text-xs text-[var(--color-text-secondary)]">
 This link is single use and expires. If it stops working, generate a new one.
 Open it in a private/incognito window (or sign out first) so it is not applied to your admin session.
 </p>
 </div>
 </DialogContent>
 </Dialog>

 <Dialog open={!!quickAddKind} onOpenChange={(open) => { if (!open) closeQuickAdd(); }}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>{quickAddKind === 'role' ? 'Add role' : 'Add department'}</DialogTitle>
 </DialogHeader>
 <div className="space-y-3">
 <div className="space-y-1.5">
 <Label>{quickAddKind === 'role' ? 'Role name' : 'Department name'}</Label>
 <Input
 value={quickAddName}
 onChange={(e) => { setQuickAddName(e.target.value); setQuickAddError(null); }}
 placeholder={quickAddKind === 'role' ? 'e.g. Shift Lead' : 'e.g. Operations'}
 onKeyDown={(e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 submitQuickAdd();
 }
 }}
 aria-invalid={!!quickAddError}
 className={quickAddError ? 'border-[var(--color-alert-600)] focus-visible:ring-[var(--color-alert-600)]' : undefined}
 />
 {quickAddError && (
 <p className="text-xs text-[var(--color-alert-600)]">{quickAddError}</p>
 )}
 </div>
 <div className="flex justify-end gap-2">
 <Button type="button" variant="outline" onClick={closeQuickAdd}>Cancel</Button>
 <Button type="button" onClick={submitQuickAdd}>
 {quickAddKind === 'role' ? 'Add role' : 'Add department'}
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 );
}
