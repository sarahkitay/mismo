import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PRODUCTION_SQL = [
  '01_full_schema.sql',
  '02_ai_hr_laws.sql',
  '03_storage.sql',
  '04_rls_policies.sql',
  '05_auth_bridge.sql',
  '06_production_bootstrap.sql',
  '09_resolve_app_session.sql',
  '10_reports_rls_split.sql',
  '11_rls_claims_fallback.sql',
  '12_client_companies.sql',
  '13_client_summary_fields.sql',
  '14_user_job_title.sql',
  '15_client_crm_super_admin.sql',
  '16_prompts_rls_admin_write.sql',
  '17_prompts_rls_incident_update.sql',
  '18_prompt_deliveries_rls_own_rows.sql',
  '19_policy_law_digest.sql',
  '20_report_child_rls.sql',
  '21_app_notifications.sql',
  '22_ca_paid_sick_leave_sb616.sql',
];

describe('inspectable schema migrations', () => {
  it('keeps production SQL in docs/database and supabase/migrations', () => {
    for (const name of PRODUCTION_SQL) {
      const docs = resolve('docs/database', name);
      expect(existsSync(docs), docs).toBe(true);
      const match = readdirSync(resolve('supabase/migrations')).find((f) => f.endsWith(name));
      expect(match, `missing migration copy of ${name}`).toBeTruthy();
      const copied = readFileSync(resolve('supabase/migrations', match!), 'utf8');
      expect(copied).toBe(readFileSync(docs, 'utf8'));
    }
  });

  it('does not copy destructive demo wipe into the ordered migration chain', () => {
    const names = readdirSync(resolve('supabase/migrations'));
    expect(names.some((n) => n.includes('08_clear_business_data'))).toBe(false);
  });
});
