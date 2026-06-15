# AWS Database Setup — Mismo

Production database schema for transferring Mismo off `localStorage` to **Amazon RDS PostgreSQL**.

## Files

| File | Purpose |
|------|---------|
| [`AWS_RDS_POSTGRES_SCHEMA.sql`](./AWS_RDS_POSTGRES_SCHEMA.sql) | **Full DDL** — enums, tables, indexes, views, triggers, seed org, migration checklist |

## Quick start (RDS)

1. **Create the database** on RDS (PostgreSQL 15+ recommended).
2. **Connect** with a admin/migration user (psql, DBeaver, or RDS Query Editor v2).
3. **Run the schema:**

```bash
psql "host=YOUR-RDS-ENDPOINT.rds.amazonaws.com port=5432 dbname=mismo user=mismo_migration sslmode=require" \
  -f docs/AWS_RDS_POSTGRES_SCHEMA.sql
```

4. **Create the app user** (password from Secrets Manager):

```sql
CREATE ROLE mismo_app LOGIN PASSWORD 'your-secret-password';
GRANT CONNECT ON DATABASE mismo TO mismo_app;
GRANT USAGE ON SCHEMA public TO mismo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mismo_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mismo_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mismo_app;
```

5. **Store connection string** in AWS Secrets Manager and expose to your API / Lambda / ECS task as:

```
DATABASE_URL=postgresql://mismo_app:****@host:5432/mismo?sslmode=require
```

## What the schema covers

Mapped 1:1 from `src/types/index.ts` and `src/hooks/useDataStore.ts`:

- **Tenancy:** `organizations` + `org_id` on every business table
- **Users & auth:** `users`, `auth_credentials`, `user_sessions`, notification prefs
- **Check-ins:** `prompts`, `prompt_deliveries`, `prompt_responses`, `check_in_deferrals` (replaces `src/lib/checkInGate.ts` localStorage)
- **Case register:** `reports` + ledger, checklist, messages, attachments, status events
- **Investigations:** full normalized workflow (persons, evidence, notes, corrective actions, follow-ups, stage history)
- **Memos & portal:** `policies`, `policy_acknowledgements`, `company_resources`, `emergency_hotlines`, `announcements`
- **Ops:** `nudges`, `activity_events`, `audit_logs`, `metrics_snapshots`
- **Views:** open case register, pending check-ins, yes-responses needing review

## Attachments (S3, not database blobs)

Demo code stores `dataUrl` base64 in the browser. In AWS:

- Upload files to **S3** (`mismo-{env}-files`)
- Store only `storage_key` in `report_attachments`, `investigation_evidence`, etc.
- Use presigned URLs for upload/download from the employee/admin portal

## Suggested AWS stack

| Component | Service |
|-----------|---------|
| Database | RDS PostgreSQL or Aurora PostgreSQL |
| Credentials | Secrets Manager |
| File storage | S3 + KMS |
| Auth (optional) | Cognito → `auth_credentials.cognito_sub` |
| Daily prompt cron | EventBridge + Lambda (replaces client-side delivery creation in `useDataStore.ts`) |
| Connection pooling | RDS Proxy (if using Lambda) |

## Migrating existing demo data

1. Export `localStorage` key `mismo_app_v2` from a browser session (JSON).
2. Transform IDs and nested arrays into INSERT statements per table (see migration checklist at bottom of `.sql` file).
3. Upload any embedded `dataUrl` attachments to S3 first; insert `storage_key` values.
4. Point the API layer at RDS; remove client-side persistence in `useDataStore.ts` incrementally.

## Row-level security (production)

The SQL file includes commented RLS templates. Enable after your API sets session context:

```sql
SET app.current_org_id = 'org-mismo-1';
```

Apply `ENABLE ROW LEVEL SECURITY` + org policies on all tenant tables before multi-customer launch.

## TypeScript ↔ SQL naming

| TypeScript (camelCase) | PostgreSQL (snake_case) |
|------------------------|-------------------------|
| `orgId` | `org_id` |
| `createdAt` | `created_at` |
| `promptDeliveryId` | `prompt_delivery_id` |
| `sourcePromptResponseId` | `source_prompt_response_id` |
| `linkedReportIds[]` | `investigation_linked_reports` junction table |
| `wageHourIntake` | `reports.wage_hour_intake` (JSONB) |
| `settings` on Organization | `organizations.settings` (JSONB) |

## Next steps after schema is applied

1. Add a backend API (Node/Lambda/ECS) with org-scoped queries.
2. Replace `localStorage.setItem('mismo_app_v2', …)` writes with API calls.
3. Wire `check_in_deferrals` table to `src/lib/checkInGate.ts`.
4. Run daily prompt delivery via scheduled job instead of the employee `useEffect` in `useDataStore.ts`.
