import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const hookFiles = readdirSync(resolve('src/hooks'))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => readFileSync(resolve('src/hooks', f), 'utf8'));
const store = hookFiles.join('\n');

function fnBody(name: string): string {
  const start = store.indexOf(`const ${name} = useCallback`);
  expect(start, `missing ${name}`).toBeGreaterThan(-1);
  const arrow = store.indexOf('=>', start);
  const open = store.indexOf('{', arrow);
  let depth = 0;
  for (let i = open; i < store.length; i++) {
    if (store[i] === '{') depth += 1;
    if (store[i] === '}') {
      depth -= 1;
      if (depth === 0) return store.slice(start, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

describe('report writes are fail-closed', () => {
  const createFns = [
    'createReport',
    'beginWageHourCase',
    'completeWageHourIntake',
    'completeIncidentIntake',
    'submitExpeditedPayrollReport',
    'beginIncidentCaseFromPrompt',
  ];

  it('awaits persist and rolls back or throws on failure for create/intake paths', () => {
    for (const name of createFns) {
      const body = fnBody(name);
      expect(body, `${name} must be async`).toContain('async');
      expect(body, `${name} must await persist`).toMatch(
        /await persist(Report|ReportChange|ResponseThenReport)\(/
      );
      expect(body, `${name} must not fire-and-forget persistReport`).not.toMatch(/void persistReport\(/);
      expect(body, `${name} must surface persist failure`).toMatch(
        /if \(!persisted(\.ok|Ok)\)/
      );
    }
  });
});
