export type EmployeeCsvFieldMap = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  employeeId: string;
  location: string;
  archiveStart: string;
  archiveEnd: string;
};

export type EmployeeImportConflictMode = 'SKIP' | 'UPDATE' | 'CREATE_NEW';

export type EmployeeImportCreate = {
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
};

export type EmployeeImportUpdate = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  departmentId?: string;
  employeeId?: string;
  location?: string;
  archiveStartDate?: Date;
  archiveEndDate?: Date;
};

export function parseEmployeeCsv(csvText: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
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
}

export function suggestEmployeeCsvFieldMap(headers: string[]): EmployeeCsvFieldMap {
  return {
    firstName: headers.find((h) => /first.?name/i.test(h)) ?? '',
    lastName: headers.find((h) => /last.?name/i.test(h)) ?? '',
    email: headers.find((h) => /email/i.test(h)) ?? '',
    phone: headers.find((h) => /phone|mobile/i.test(h)) ?? '',
    department: headers.find((h) => /department|dept/i.test(h)) ?? '',
    employeeId: headers.find((h) => /employee.?id|badge|payroll.?id/i.test(h)) ?? '',
    location: headers.find((h) => /location|site|office/i.test(h)) ?? '',
    archiveStart: headers.find((h) => /archive.?start|retention.?start/i.test(h)) ?? '',
    archiveEnd: headers.find((h) => /archive.?end|retention.?end/i.test(h)) ?? '',
  };
}

function parseOptionalDate(raw: string | undefined): Date | undefined {
  if (!raw?.trim()) return undefined;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function planEmployeeCsvImport(opts: {
  rows: Record<string, string>[];
  fieldMap: EmployeeCsvFieldMap;
  conflictMode: EmployeeImportConflictMode;
  departments: { id: string; name: string }[];
  users: { id: string; email: string }[];
  now?: number;
}): {
  created: number;
  updated: number;
  errors: string[];
  batchToCreate: EmployeeImportCreate[];
  updates: EmployeeImportUpdate[];
} {
  const { rows, fieldMap, conflictMode, departments, users } = opts;
  const dupStamp = opts.now ?? Date.now();
  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  const batchToCreate: EmployeeImportCreate[] = [];
  const updates: EmployeeImportUpdate[] = [];

  rows.forEach((row, index) => {
    const firstName = row[fieldMap.firstName] || '';
    const lastName = row[fieldMap.lastName] || '';
    const email = row[fieldMap.email] || '';
    const phone = row[fieldMap.phone] || undefined;
    const departmentId = departments.find(
      (d) => d.name.toLowerCase() === (row[fieldMap.department] || '').toLowerCase()
    )?.id;

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
      updates.push({
        id: existing.id,
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
      email: `${email.split('@')[0]}+dup${dupStamp}@${email.split('@')[1] ?? 'example.com'}`,
      phone,
      departmentId,
      status: 'active',
      ...(employeeIdVal ? { employeeId: `${employeeIdVal}-dup` } : {}),
      ...(locationVal ? { location: locationVal } : {}),
    });
    created += 1;
  });

  return { created, updated, errors, batchToCreate, updates };
}
