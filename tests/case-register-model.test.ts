import { describe, expect, it } from 'vitest';
import { deriveBucket, isOpenReport, isOverSla } from '@/lib/caseRegisterModel';
import type { Report } from '@/types';

describe('caseRegisterModel', () => {
  it('derives prompt vs register buckets from filters', () => {
    expect(deriveBucket({}, 'prompt-responses')).toBe('PROMPT_ALL');
    expect(deriveBucket({ answer: 'HAS_ISSUE' }, 'prompt-responses')).toBe('PROMPT_YES');
    expect(deriveBucket({ view: 'register' }, 'prompt-responses')).toBe('CASE_REGISTER');
    expect(deriveBucket({ critical: '1' }, 'case-register')).toBe('NEW_CRITICAL');
  });

  it('treats resolved reports as not over SLA', () => {
    const r = {
      status: 'RESOLVED',
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
    } as Report;
    expect(isOpenReport(r)).toBe(false);
    expect(isOverSla(r)).toBe(false);
  });
});
