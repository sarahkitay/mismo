import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve('docs/database/10_reports_rls_split.sql'), 'utf8');
const rls = readFileSync(resolve('docs/database/04_rls_policies.sql'), 'utf8');
const helpers = readFileSync(resolve('docs/database/11_rls_claims_fallback.sql'), 'utf8');

describe('Postgres RLS artifacts in the public repo', () => {
  it('scopes every reports policy to current_org_id()', () => {
    for (const name of ['reports_select', 'reports_insert', 'reports_update', 'reports_delete']) {
      expect(sql).toContain(`CREATE POLICY ${name} ON reports`);
    }
    expect(sql).toMatch(/org_id = public\.current_org_id\(\)/);
  });

  it('lets employees file own or anonymous cases, not the org register', () => {
    expect(sql).toContain('created_by_user_id = public.current_app_user_id()');
    expect(sql).toContain('is_anonymous = true');
    expect(sql).toContain('created_by_user_id IS NULL');
    expect(sql).toMatch(/reports_delete[\s\S]*is_admin_or_hr\(\)/);
  });

  it('enables org isolation on core business tables', () => {
    for (const table of [
      'prompt_responses',
      'investigations',
      'policies',
      'audit_logs',
      'activity_events',
    ]) {
      expect(rls).toContain(`enable_org_rls('${table}')`);
    }
  });

  it('resolves tenant context from JWT claims with auth.uid() fallback', () => {
    expect(helpers).toContain('auth.jwt()');
    expect(helpers).toContain('auth.uid()');
    expect(helpers).toContain('SECURITY DEFINER');
    expect(helpers).toContain("IN ('ADMIN', 'HR', 'SUPER_ADMIN', 'MANAGER')");
  });
});
