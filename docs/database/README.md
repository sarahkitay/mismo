# Mismo Database

PostgreSQL schema for production. Maps 1:1 from `src/types/index.ts` and `src/hooks/useDataStore.ts`.

**Important:** The employee and admin apps must never show or reference the database vendor. The browser uses `VITE_API_BASE_URL` (Mismo API) only — no direct database client in the frontend.

## SQL files (run in order)

| Order | File | Purpose |
|-------|------|---------|
| 1 | [`01_full_schema.sql`](./01_full_schema.sql) | Core tables, enums, views, demo seed org |
| 2 | [`02_ai_hr_laws.sql`](./02_ai_hr_laws.sql) | HR law corpus, AI jobs, outreach coach sessions |
| 3 | [`03_storage.sql`](./03_storage.sql) | Private file buckets + storage RLS |
| 4 | [`05_auth_bridge.sql`](./05_auth_bridge.sql) | Auth ↔ `public.users` linking + JWT claims |
| 5 | [`04_rls_policies.sql`](./04_rls_policies.sql) | Multi-tenant row-level security |

## localStorage → Postgres

| Demo entity | Table(s) |
|-------------|----------|
| `mismo_session` | `user_sessions` |
| `users` | `users` (+ auth link) |
| `prompts` / deliveries / responses | `prompts`, `prompt_deliveries`, `prompt_responses` |
| `reports` (+ ledger, checklist) | `reports` + child tables |
| `investigations` | `investigations` + child tables |
| `policies` / acknowledgements | `policies`, `policy_acknowledgements` |
| `checkInGate` localStorage | `check_in_deferrals` |
| Attachments (base64 in demo) | Private storage + `storage_key` column |

## TypeScript ↔ SQL naming

| TypeScript | PostgreSQL |
|------------|------------|
| `orgId` | `org_id` |
| `createdAt` | `created_at` |
| `expeditedPayroll` | `expedited_payroll` |
| `payrollSlaDueAt` | `payroll_sla_due_at` |
| `wageHourIntake` | `wage_hour_intake` (JSONB) |
| `window` (MetricSnapshot) | `time_window` |

## Platform setup

Developer setup (hosting provider configuration): [`SUPABASE_SETUP.md`](./SUPABASE_SETUP.md)

Legacy AWS RDS scripts remain in `docs/AWS_RDS_POSTGRES_SCHEMA.sql` for reference only.

## Next steps after schema

1. Point `services/api` at `DATABASE_URL` (server-side only).
2. Replace `localStorage` writes in `useDataStore.ts` with API calls.
3. Enable auth hook + JWT claims (`05_auth_bridge.sql`).
4. Wire OpenAI jobs to `ai_job_runs` and `hr_law_*` tables.
