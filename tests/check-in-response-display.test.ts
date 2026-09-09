import { describe, expect, it } from 'vitest';
import {
  checkInResponseDisplayLabel,
  incidentFacingCheckInNotes,
  isWageHourOrientedResponse,
} from '@/lib/checkInResponseDisplay';

const incidentPrompt = { title: 'Incident Query', type: 'INCIDENT' as const };

describe('checkInResponseDisplayLabel', () => {
  it('keeps workplace incident Yes as Incident Query', () => {
    const display = checkInResponseDisplayLabel(
      incidentPrompt,
      {
        answer: 'HAS_ISSUE',
        notes:
          'Financial follow-up: employee indicated a pay, compensation, or benefits-related concern.',
      },
      { caseType: 'WORKPLACE_INVESTIGATION' }
    );
    expect(display.title).toBe('Incident Query');
    expect(display.type).toBe('INCIDENT');
  });

  it('labels linked wage & hour cases as Wage & Hour Query', () => {
    const display = checkInResponseDisplayLabel(
      incidentPrompt,
      { answer: 'NO_ISSUE', notes: null },
      { caseType: 'WAGE_HOUR' }
    );
    expect(display.title).toBe('Wage & Hour Query');
    expect(display.type).toBe('WAGE_HOUR');
  });

  it('labels pay-only financial follow-up after workplace No', () => {
    expect(
      isWageHourOrientedResponse({
        answer: 'NO_ISSUE',
        notes:
          'Financial follow-up: employee chose to complete the full wage & hour report sheet (no workplace incident indicated).',
      })
    ).toBe(true);
    const display = checkInResponseDisplayLabel(incidentPrompt, {
      answer: 'NO_ISSUE',
      notes:
        'Payroll memo: employee reported a payroll issue with no additional details (no workplace incident indicated).',
    });
    expect(display.title).toBe('Wage & Hour Query');
  });

  it('does not treat a plain No as wage & hour', () => {
    const display = checkInResponseDisplayLabel(incidentPrompt, {
      answer: 'NO_ISSUE',
      notes: 'Financial follow-up: no pay, compensation, or benefits-related concern indicated.',
    });
    expect(display.title).toBe('Incident Query');
  });

  it('hides financial follow-up notes on workplace incident cases', () => {
    expect(
      incidentFacingCheckInNotes(
        'Financial follow-up: no pay, compensation, or benefits-related concern indicated.'
      )
    ).toBeUndefined();
    expect(incidentFacingCheckInNotes('Employee described unsafe conditions in the warehouse.')).toBe(
      'Employee described unsafe conditions in the warehouse.'
    );
  });
});
