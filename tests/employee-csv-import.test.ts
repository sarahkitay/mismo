import { describe, expect, it } from 'vitest';
import { parseEmployeeCsv, planEmployeeCsvImport, suggestEmployeeCsvFieldMap } from '@/lib/employeeCsvImport';

describe('employeeCsvImport', () => {
  it('parses headers and suggests a field map', () => {
    const csv = 'First Name,Last Name,Email\nAda,Lovelace,ada@example.com\n';
    const parsed = parseEmployeeCsv(csv);
    expect(parsed.headers).toEqual(['First Name', 'Last Name', 'Email']);
    const map = suggestEmployeeCsvFieldMap(parsed.headers);
    expect(map.firstName).toBe('First Name');
    expect(map.email).toBe('Email');
  });

  it('plans creates and skip-on-conflict updates', () => {
    const fieldMap = suggestEmployeeCsvFieldMap(['First Name', 'Last Name', 'Email']);
    const rows = [
      { 'First Name': 'Ada', 'Last Name': 'Lovelace', Email: 'ada@example.com' },
      { 'First Name': 'Grace', 'Last Name': 'Hopper', Email: 'grace@example.com' },
    ];
    const planned = planEmployeeCsvImport({
      rows,
      fieldMap,
      conflictMode: 'SKIP',
      departments: [],
      users: [{ id: 'u1', email: 'ada@example.com' }],
    });
    expect(planned.created).toBe(1);
    expect(planned.updated).toBe(0);
    expect(planned.batchToCreate[0].email).toBe('grace@example.com');
  });
});
