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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatRelativeTime, formatPercent, getInitials } from '@/lib/utils';
import { mockDepartments } from '@/data/mockData';
import { toast } from 'sonner';

interface AdminEmployeesProps {
  dataStore: DataStore;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  initialFilters?: Record<string, string>;
}

type DirectoryFilter = 'ALL' | 'AT_RISK' | 'NEVER_RESPONDED' | 'LOW_ENGAGEMENT';
type ImportTab = 'DIRECTORY' | 'BULK_IMPORT';
type ConflictMode = 'SKIP' | 'UPDATE' | 'CREATE_NEW';
type MappingTemplate = { name: string; map: Record<string, string> };

const IMPORT_TEMPLATE_STORAGE = 'mismo_csv_mapping_templates';

export function AdminEmployees({ dataStore, onNavigate, initialFilters }: AdminEmployeesProps) {
  const { users, atRiskEmployees, sendNudge, orgSettings, getEmployeeEngagement, createUsers, updateUser } = dataStore;
  const directoryUsers = users.filter((u) => u.status === 'active');

  const [activeTab, setActiveTab] = useState<ImportTab>(initialFilters?.import === 'csv' ? 'BULK_IMPORT' : 'DIRECTORY');
  const [filter, setFilter] = useState<DirectoryFilter>(initialFilters?.atRisk === 'true' ? 'AT_RISK' : 'ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'EMPLOYEE' | 'ADMIN' | 'SUPER_ADMIN' | 'HR' | 'MANAGER' | 'CLIENT'>('ALL');

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const editingUser = directoryUsers.find((u) => u.id === editingUserId) ?? null;
  const [editRole, setEditRole] = useState<'EMPLOYEE' | 'ADMIN' | 'SUPER_ADMIN'>('EMPLOYEE');
  const [editDepartment, setEditDepartment] = useState('UNASSIGNED');
  const [editPhone, setEditPhone] = useState('');

  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<Record<string, string>[]>([]);
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: '',
    employeeId: '',
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

  const filteredEmployees = directoryUsers.filter((emp) => {
    const engagement = getEmployeeEngagement(emp.id);
    const matchesFilter =
      filter === 'ALL' ||
      (filter === 'AT_RISK' && engagement?.isAtRisk) ||
      (filter === 'NEVER_RESPONDED' && !engagement?.lastResponseAt) ||
      (filter === 'LOW_ENGAGEMENT' && engagement && engagement.responseRate30d < orgSettings.thresholds.atRiskMinResponseRate);
    const matchesSearch =
      !searchQuery ||
      emp.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = departmentFilter === 'ALL' || emp.departmentId === departmentFilter;
    const matchesRole = roleFilter === 'ALL' || emp.role === roleFilter;
    return matchesFilter && matchesSearch && matchesDepartment && matchesRole;
  });

  const getDepartmentName = (deptId?: string) => {
    if (!deptId) return 'Unassigned';
    return mockDepartments.find((d) => d.id === deptId)?.name || deptId;
  };

  const handleNudge = (employeeId: string, channel: 'EMAIL' | 'SMS' | 'MANUAL') => {
    const emp = directoryUsers.find((e) => e.id === employeeId);
    if (!emp) return;
    sendNudge(employeeId, channel, `Compliance reminder for ${emp.firstName}.`, { type: 'AT_RISK_OUTREACH' });
    toast.success(`${channel} reminder logged.`);
  };

  const openEditUser = (userId: string) => {
    const user = directoryUsers.find((item) => item.id === userId);
    if (!user) return;
    setEditingUserId(user.id);
    setEditRole((user.role as 'EMPLOYEE' | 'ADMIN' | 'SUPER_ADMIN') ?? 'EMPLOYEE');
    setEditDepartment(user.departmentId ?? 'UNASSIGNED');
    setEditPhone(user.phone ?? '');
  };

  const saveUserEdits = () => {
    if (!editingUser) return;
    updateUser(editingUser.id, {
      role: editRole,
      departmentId: editDepartment === 'UNASSIGNED' ? undefined : editDepartment,
      phone: editPhone || undefined,
    });
    toast.success('User record updated.');
    setEditingUserId(null);
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
      employeeId: headers.find((h) => /employee.?id|^id$/i.test(h)) ?? '',
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
      id?: string;
    }> = [];

    importRows.forEach((row, index) => {
      const firstName = row[fieldMap.firstName] || '';
      const lastName = row[fieldMap.lastName] || '';
      const email = row[fieldMap.email] || '';
      const phone = row[fieldMap.phone] || undefined;
      const departmentId = mockDepartments.find((d) => d.name.toLowerCase() === (row[fieldMap.department] || '').toLowerCase())?.id;

      if (!firstName || !lastName || !email) {
        errors.push(`Row ${index + 1}: missing required field(s).`);
        return;
      }

      const employeeId = fieldMap.employeeId ? (row[fieldMap.employeeId] || '').trim() : undefined;
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
          ...(employeeId ? { id: employeeId } : {}),
        });
        created += 1;
        return;
      }

      if (conflictMode === 'SKIP') return;
      if (conflictMode === 'UPDATE') {
        updateUser(existing.id, { firstName, lastName, phone, departmentId });
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
        ...(employeeId ? { id: `${employeeId}-dup-${Date.now()}` } : {}),
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
          <h1 className="text-2xl font-bold text-[var(--mismo-text)]">Users</h1>
          <p className="text-[var(--mismo-text-secondary)] mt-1">Employee directory and secure bulk onboarding</p>
        </div>
        <span className="text-sm text-[var(--mismo-text-secondary)]">
          {filteredEmployees.length} users {importedCount > 0 ? `(+${importedCount} imported)` : ''}
        </span>
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
          {atRiskEmployees.length > 0 && (
            <Card className="mismo-card border-l-4 border-l-[var(--color-alert-600)]">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-[var(--mismo-text)]">{atRiskEmployees.length} employees at risk</p>
                  <p className="text-sm text-[var(--mismo-text-secondary)]">Low engagement or no recent responses</p>
                </div>
                <Button variant="outline" onClick={() => setFilter('AT_RISK')}>View at-risk</Button>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as DirectoryFilter)}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Employees</SelectItem>
                  <SelectItem value="AT_RISK">At-Risk Only</SelectItem>
                  <SelectItem value="NEVER_RESPONDED">Never Responded</SelectItem>
                  <SelectItem value="LOW_ENGAGEMENT">Low Engagement</SelectItem>
                </SelectContent>
              </Select>
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Departments</SelectItem>
                  {mockDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
                <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Roles</SelectItem>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="HR">Human Resources</SelectItem>
                  <SelectItem value="CLIENT">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredEmployees.map((employee) => {
              const engagement = getEmployeeEngagement(employee.id);
              const isAtRisk = engagement?.isAtRisk || false;
              return (
                <Card key={employee.id} className={`employee-card mismo-card relative ${isAtRisk ? 'border-[var(--color-alert-600)]' : ''}`}>
                  <CardContent className="p-5">
                    {isAtRisk && (
                      <div className="absolute top-3 right-3">
                        <Badge className="status-chip status-chip--alert">At Risk</Badge>
                      </div>
                    )}
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-[var(--mismo-blue-light)] flex items-center justify-center">
                        <span className="text-lg font-semibold text-[var(--mismo-blue)]">{getInitials(employee.firstName, employee.lastName)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[var(--mismo-text)] truncate">{employee.firstName} {employee.lastName}</h3>
                        </div>
                        <p className="text-sm text-[var(--mismo-text-secondary)] truncate">{employee.email}</p>
                        <p className="text-sm text-[var(--mismo-text-secondary)]">{getDepartmentName(employee.departmentId)}</p>
                        <p className="text-xs text-[var(--mismo-text-secondary)] mt-1">Role: {employee.role}</p>
                      </div>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">Nudge</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {orgSettings.enableEmail && (
                            <DropdownMenuItem onClick={() => handleNudge(employee.id, 'EMAIL')}>Send Email</DropdownMenuItem>
                          )}
                          {orgSettings.enableSMS && employee.phone && (
                            <DropdownMenuItem onClick={() => handleNudge(employee.id, 'SMS')}>Send SMS</DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handleNudge(employee.id, 'MANUAL')}>Log Manual Outreach</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
            <h2 className="mismo-heading text-2xl text-[var(--color-primary-900)]">Bulk Import</h2>
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
                    {(['firstName', 'lastName', 'email', 'phone', 'department', 'employeeId'] as const).map((key) => (
                      <div key={key} className="space-y-1.5">
                        <Label>{key === 'employeeId' ? 'Employee ID (optional)' : key === 'firstName' ? 'First name' : key === 'lastName' ? 'Last name' : key}</Label>
                        <Select value={fieldMap[key] ?? ''} onValueChange={(v) => setFieldMap((prev) => ({ ...prev, [key]: v }))}>
                          <SelectTrigger><SelectValue placeholder="Select CSV column" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">— None —</SelectItem>
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
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 5).map((row, idx) => (
                          <tr key={idx} className="border-t border-[var(--color-border-200)]">
                            <td className="px-3 py-2">{row[fieldMap.firstName] ?? ''}</td>
                            <td className="px-3 py-2">{row[fieldMap.lastName] ?? ''}</td>
                            <td className="px-3 py-2">{row[fieldMap.email] ?? ''}</td>
                            <td className="px-3 py-2">{row[fieldMap.department] ?? ''}</td>
                            <td className="px-3 py-2">{fieldMap.employeeId ? (row[fieldMap.employeeId] ?? '') : '—'}</td>
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

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as typeof editRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={editDepartment} onValueChange={setEditDepartment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                  {mockDepartments.map((dept) => (
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
              <Button onClick={saveUserEdits}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
