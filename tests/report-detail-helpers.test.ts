import { describe, expect, it } from 'vitest';
import { buildHrSignOff, getSlaLabel } from '@/lib/reportDetailHelpers';

describe('reportDetailHelpers', () => {
  it('labels closed reports as Closed', () => {
    expect(
      getSlaLabel({
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2020-01-02'),
        status: 'CLOSED',
      })
    ).toEqual({ label: 'Closed', overdue: false });
  });

  it('builds an HR sign-off block', () => {
    const text = buildHrSignOff({
      firstName: 'Pat',
      lastName: 'Lee',
      organizationName: 'Acme',
      caseReference: 'INV-1',
    });
    expect(text).toContain('Pat Lee');
    expect(text).toContain('Case reference: INV-1');
  });
});
