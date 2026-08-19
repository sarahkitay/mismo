# Architecture (what this repository actually contains)

Mismo is a **Vite + React HR/compliance application** backed by **Supabase Auth, Postgres RLS, and Edge Functions**. This public repo is a sanitized product surface: schema, policies, UI, and API handlers — not production customer data.

## Request path

```
Browser (anon key only)
  → Supabase Auth (user JWT)
  → Postgres via user JWT  → RLS (org_id + role)
  → Edge Function mismo-api (verify_jwt = true)
       → authorizeCaller() binds JWT → public.users (org, role)
       → service role used only server-side after that check
```

The service role key never ships to the browser. RLS is the isolation boundary for table access; Edge Functions re-check identity before privileged side effects (invite, mail, law sync).

## Why two Edge Functions

| Function | Gateway JWT | Why |
|----------|-------------|-----|
| `mismo-api` | **on** (`verify_jwt = true`) | All user/HR routes. A request without a project JWT is rejected before handler code runs. |
| `mismo-cron` | **off** | pg_net / EventBridge cannot present a user session. The only route requires `CRON_SECRET`. No user-data APIs are registered here. |

Gateway JWT is necessary but not sufficient. `authorizeCaller` in `supabase/functions/_shared/auth.ts` maps `auth.uid()` to `public.users` and enforces privileged roles. Client-supplied `orgId` is ignored on org-scoped writes; the caller profile wins.

Route catalog (kept in lockstep by tests): `src/lib/authz/routes.ts`.

## Tenant isolation (Postgres)

Defined in `docs/database/04_rls_policies.sql`, `10_reports_rls_split.sql`, `11_rls_claims_fallback.sql`:

- `current_org_id()` / `current_app_user_id()` / `current_user_role()` read JWT claims, then fall back to `public.users` via `auth.uid()`.
- Most tables: `org_id = current_org_id()`.
- `reports`: employees see/update rows they filed; HR/admin see the org register; anonymous inserts require `created_by_user_id IS NULL`.
- TypeScript mirror used in tests: `src/lib/authz/policy.ts`.
- Two-org integration tests load the production RLS files into Postgres and run as `authenticated`: `tests/integration/cross-tenant-rls.test.ts`.
- Threat model and tenant boundary: [`docs/THREAT_MODEL.md`](THREAT_MODEL.md).

## What is — and is not — claimed

**In this repo:** org scoping, RBAC helpers, RLS SQL, fail-closed report inserts, case-register counting rules, a law-corpus publish gate, two-tenant Postgres RLS tests, and a written threat model.

**Not in this repo:** a full penetration test, SOC 2 evidence, live production load tests, or production secrets. Treat this as an inspectable product codebase, not a completed security audit.
