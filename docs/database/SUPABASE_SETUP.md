# Supabase setup (developers only)

Internal guide for hosting Mismo on Supabase. **Do not reference Supabase in the product UI, marketing, or frontend environment variable names.**

---

## 1. Create project

1. Create a new Supabase project (PostgreSQL 15+).
2. Note the **project URL** and keys from Settings → API:
   - `anon` key → safe for authenticated client (with RLS)
   - `service_role` key → **server / Edge Functions only — never in Vite**

---

## 2. Run SQL migrations

Open **SQL Editor** and run each file in order (copy/paste or CLI):

```bash
# Optional: Supabase CLI
supabase link --project-ref YOUR_PROJECT_REF
supabase db execute -f docs/database/01_full_schema.sql
supabase db execute -f docs/database/02_ai_hr_laws.sql
supabase db execute -f docs/database/03_storage.sql
supabase db execute -f docs/database/05_auth_bridge.sql
supabase db execute -f docs/database/04_rls_policies.sql
```

If `03_storage.sql` bucket insert fails, create buckets in Dashboard → Storage:

- `mismo-files` (private, 50MB)
- `mismo-signatures` (private, 2MB)

---

## 3. Auth configuration

1. **Authentication → Providers** — enable Email (or SSO later).
2. **Authentication → Hooks → Custom Access Token** — point to `public.custom_access_token_hook` (from `05_auth_bridge.sql`).
3. Pre-create rows in `public.users` with matching emails before first login, or import from demo data.
4. On first login, `handle_new_auth_user` links `auth.users.id` → `users.auth_user_id`.

JWT claims used by RLS:

| Claim | Source |
|-------|--------|
| `org_id` | `users.org_id` |
| `app_user_id` | `users.id` |
| `user_role` | `users.role` |

---

## 4. Environment variables

### Frontend (`.env.local`) — no vendor keys

```bash
VITE_API_BASE_URL=https://your-mismo-api.example.com
VITE_AI_FEATURES_ENABLED=true
```

### API / Edge Functions (server only)

```bash
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
# Or direct connection on port 5432 for migrations

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1

# If using Supabase client in API (optional):
SUPABASE_URL=https://[ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # NEVER prefix with VITE_
```

Use **connection pooler** (port 6543) for serverless; direct connection for migrations.

---

## 5. Scheduled jobs

| Job | Suggested schedule | Implementation |
|-----|-------------------|----------------|
| Daily prompt deliveries | Daily 12:00 UTC | Edge Function + cron |
| HR law sync | Weekly Mon 06:00 UTC | Edge Function or `services/api` |
| HR law notify | Daily 14:00 UTC | Edge Function + email (Resend/SES) |
| Outreach coach | On demand | `POST /ai/outreach/coach` via API |

Store `OPENAI_API_KEY` in Supabase **Edge Function secrets**, not in the database.

---

## 6. Architecture rule

```
Browser (React)
    → Mismo API (Edge Functions / services/api)
        → Postgres (RLS + service_role for admin jobs)
        → Private storage (signed URLs)
        → OpenAI (server only)
```

The React app **never** imports `@supabase/supabase-js` in production unless you deliberately use anon key + RLS for a subset of features — and even then, hide vendor branding in UI.

Recommended: single `VITE_API_BASE_URL` and all data through your API layer.

---

## 7. Import demo data

1. Export `localStorage` key `mismo_app_v2` from browser.
2. Transform JSON → SQL INSERTs per table (see `docs/database/README.md` mapping).
3. Upload attachment data URLs to `mismo-files` bucket; set `storage_key` paths.

---

## 8. Verify

```sql
SELECT id, name FROM organizations;
SELECT count(*) FROM hr_law_jurisdictions;  -- expect 51
SELECT * FROM v_open_case_register LIMIT 5;
```

Test auth: sign in as a seeded user → JWT should include `org_id` and `app_user_id`.

---

## Related

- [`README.md`](./README.md) — schema overview (vendor-neutral)
- [`../OPENAI_HR_ASSISTANT.md`](../OPENAI_HR_ASSISTANT.md) — AI features
- [`../../services/api/README.md`](../../services/api/README.md) — API handlers
