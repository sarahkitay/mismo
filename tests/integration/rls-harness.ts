/**
 * Connects to Postgres, loads production RLS SQL, and impersonates
 * role `authenticated` the way PostgREST/Supabase do (auth.uid / auth.jwt).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

export type TestUser = {
  appUserId: string;
  orgId: string;
  role: string;
  authUserId: string;
  email: string;
};

export type QueryResult<T> = { rows: T[]; rowCount: number };

export const ORG_A = 'org-a';
export const ORG_B = 'org-b';

export const users = {
  hrA: {
    appUserId: 'user-hr-a',
    orgId: ORG_A,
    role: 'HR',
    authUserId: '00000000-0000-4000-8000-0000000000a1',
    email: 'hr-a@example.test',
  },
  empA: {
    appUserId: 'user-emp-a',
    orgId: ORG_A,
    role: 'EMPLOYEE',
    authUserId: '00000000-0000-4000-8000-0000000000a2',
    email: 'emp-a@example.test',
  },
  hrB: {
    appUserId: 'user-hr-b',
    orgId: ORG_B,
    role: 'HR',
    authUserId: '00000000-0000-4000-8000-0000000000b1',
    email: 'hr-b@example.test',
  },
  empB: {
    appUserId: 'user-emp-b',
    orgId: ORG_B,
    role: 'EMPLOYEE',
    authUserId: '00000000-0000-4000-8000-0000000000b2',
    email: 'emp-b@example.test',
  },
} as const satisfies Record<string, TestUser>;

const ENABLE_ORG_RLS_TABLES = [
  'departments',
  'prompts',
  'prompt_deliveries',
  'prompt_responses',
  'report_status_events',
  'investigations',
  'policies',
  'company_resources',
  'emergency_hotlines',
  'announcements',
  'nudges',
  'activity_events',
  'audit_logs',
  'metrics_snapshots',
  'check_in_deferrals',
  'wage_hour_screening_acknowledgements',
  'org_hr_law_watchlists',
  'outreach_coach_sessions',
  'hr_law_notifications',
  'ai_job_runs',
];

function sqlFile(name: string): string {
  return readFileSync(resolve('docs/database', name), 'utf8');
}

export function postgresConfig(): { connectionString?: string; host?: string; database: string; user?: string } {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, database: 'from-url' };
  }
  return {
    host: process.env.PGHOST || '/tmp',
    database: process.env.PGDATABASE || 'mismo_rls_test',
    user: process.env.PGUSER,
  };
}

export async function ensureTestDatabase(): Promise<void> {
  if (process.env.DATABASE_URL) return;
  const dbName = process.env.PGDATABASE || 'mismo_rls_test';
  const admin = new Client({
    host: process.env.PGHOST || '/tmp',
    database: 'postgres',
    user: process.env.PGUSER,
  });
  await admin.connect();
  try {
    const found = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if ((found.rowCount ?? 0) === 0) {
      await admin.query(`CREATE DATABASE ${dbName}`);
    }
  } finally {
    await admin.end();
  }
}

export async function createRlsDatabase(): Promise<Client> {
  await ensureTestDatabase();
  const cfg = postgresConfig();
  const db = cfg.connectionString
    ? new Client({ connectionString: cfg.connectionString })
    : new Client({ host: cfg.host, database: cfg.database, user: cfg.user });
  await db.connect();

  await db.query(`
    DROP SCHEMA IF EXISTS public CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public;
    CREATE SCHEMA auth;
    GRANT ALL ON SCHEMA public TO CURRENT_USER;
    GRANT USAGE ON SCHEMA public TO public;
  `);

  await db.query(`
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text
    );

    CREATE OR REPLACE FUNCTION auth.jwt()
    RETURNS jsonb
    LANGUAGE sql
    STABLE
    AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
    $$;

    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$
      SELECT COALESCE(
        NULLIF(auth.jwt() ->> 'sub', ''),
        NULLIF(current_setting('request.jwt.claim.sub', true), '')
      )::uuid;
    $$;

    DO $role$
    BEGIN
      CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END
    $role$;

    CREATE TABLE organizations (
      id text PRIMARY KEY,
      name text NOT NULL,
      settings jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE users (
      id text PRIMARY KEY,
      org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
      role text NOT NULL DEFAULT 'EMPLOYEE',
      first_name text NOT NULL,
      last_name text NOT NULL,
      email text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE reports (
      id text PRIMARY KEY,
      org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
      is_anonymous boolean NOT NULL DEFAULT false,
      summary text NOT NULL DEFAULT '',
      description text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'NEW',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE hr_law_jurisdictions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      state_code char(2) NOT NULL UNIQUE,
      state_name text NOT NULL
    );

    CREATE TABLE hr_law_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      jurisdiction_id uuid NOT NULL REFERENCES hr_law_jurisdictions(id) ON DELETE CASCADE,
      title text NOT NULL,
      summary text NOT NULL DEFAULT ''
    );

    CREATE TABLE hr_law_updates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id text REFERENCES organizations(id) ON DELETE CASCADE,
      title text NOT NULL,
      summary text NOT NULL DEFAULT ''
    );
  `);

  for (const table of ENABLE_ORG_RLS_TABLES) {
    if (table === 'investigations') {
      await db.query(`
        CREATE TABLE investigations (
          id text PRIMARY KEY,
          org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          status text NOT NULL DEFAULT 'OPEN',
          owner_id text NOT NULL REFERENCES users(id),
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      continue;
    }
    if (table === 'audit_logs') {
      await db.query(`
        CREATE TABLE audit_logs (
          id text PRIMARY KEY,
          org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          record_type text NOT NULL,
          record_id text NOT NULL,
          actor_user_id text NOT NULL REFERENCES users(id),
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      continue;
    }
    if (table === 'policies') {
      await db.query(`
        CREATE TABLE policies (
          id text PRIMARY KEY,
          org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          title text NOT NULL,
          content text NOT NULL DEFAULT '',
          effective_date timestamptz NOT NULL DEFAULT now(),
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `);
      continue;
    }
    await db.query(`
      CREATE TABLE ${table} (
        id text PRIMARY KEY,
        org_id text NOT NULL REFERENCES organizations(id) ON DELETE CASCADE
      );
    `);
  }

  await seed(db);

  await db.query(sqlFile('04_rls_policies.sql'));
  await db.query(sqlFile('10_reports_rls_split.sql'));
  await db.query(sqlFile('11_rls_claims_fallback.sql'));

  await db.query(`
    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

    DO $force$
    DECLARE
      r record;
    BEGIN
      FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      LOOP
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', r.tablename);
      END LOOP;
    END
    $force$;
  `);

  return db;
}

async function seed(db: Client): Promise<void> {
  await db.query(`
    INSERT INTO organizations (id, name) VALUES
      ('${ORG_A}', 'Northwind HR'),
      ('${ORG_B}', 'Contoso HR');
  `);

  for (const user of Object.values(users)) {
    await db.query(`INSERT INTO auth.users (id, email) VALUES ($1::uuid, $2)`, [
      user.authUserId,
      user.email,
    ]);
    await db.query(
      `INSERT INTO users (id, org_id, auth_user_id, role, first_name, last_name, email)
       VALUES ($1, $2, $3::uuid, $4, $5, $6, $7)`,
      [user.appUserId, user.orgId, user.authUserId, user.role, user.role, user.orgId, user.email]
    );
  }

  await db.query(`
    INSERT INTO reports (id, org_id, created_by_user_id, is_anonymous, summary, description, status)
    VALUES
      ('report-a', '${ORG_A}', 'user-emp-a', false, 'Org A workplace case', 'Tenant A only', 'NEW'),
      ('report-b', '${ORG_B}', 'user-emp-b', false, 'Org B workplace case', 'Tenant B only', 'NEW');

    INSERT INTO investigations (id, org_id, status, owner_id)
    VALUES
      ('inv-a', '${ORG_A}', 'OPEN', 'user-hr-a'),
      ('inv-b', '${ORG_B}', 'OPEN', 'user-hr-b');

    INSERT INTO audit_logs (id, org_id, record_type, record_id, actor_user_id)
    VALUES
      ('audit-a', '${ORG_A}', 'REPORT', 'report-a', 'user-hr-a'),
      ('audit-b', '${ORG_B}', 'REPORT', 'report-b', 'user-hr-b');

    INSERT INTO policies (id, org_id, title, content)
    VALUES
      ('policy-a', '${ORG_A}', 'Org A handbook', 'Internal A'),
      ('policy-b', '${ORG_B}', 'Org B handbook', 'Internal B');
  `);
}

export async function asUser<T>(
  db: Client,
  user: TestUser,
  fn: () => Promise<T>,
  opts?: { jwt?: Record<string, string>; subOnly?: boolean }
): Promise<T> {
  const jwt = opts?.subOnly
    ? { sub: user.authUserId }
    : {
        sub: user.authUserId,
        org_id: user.orgId,
        app_user_id: user.appUserId,
        user_role: user.role,
        ...opts?.jwt,
      };
  await db.query('BEGIN');
  try {
    await db.query('SET LOCAL ROLE authenticated');
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify(jwt)]);
    return await fn();
  } finally {
    await db.query('ROLLBACK');
  }
}
