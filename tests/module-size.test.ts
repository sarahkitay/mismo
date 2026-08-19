import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('module size ceilings', () => {
  it('keeps the data store hook below a god-file threshold', () => {
    expect(statSync(resolve('src/hooks/useDataStore.ts')).size).toBeLessThan(70_000);
  });

  it('keeps the previously oversized admin pages under 50 KB', () => {
    for (const file of [
      'src/pages/admin/AdminCaseRegisterHub.tsx',
      'src/pages/admin/AdminEmployees.tsx',
      'src/pages/admin/AdminEmployeeDetail.tsx',
      'src/pages/admin/AdminReportDetail.tsx',
    ]) {
      expect(statSync(resolve(file)).size, file).toBeLessThan(50_000);
    }
  });
});
