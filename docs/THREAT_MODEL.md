# Threat model and tenant boundary

This document is the public account of what Mismo isolates, where isolation is enforced, and what is out of scope. It is not a pentest report.

## Tenant boundary

A **tenant** is one row in `organizations`. Every business record that is not the shared HR-law corpus carries `org_id` and must equal the caller's organization.

Caller identity for table access is:

1. A Supabase Auth JWT (gateway on `mismo-api`).
2. `public.current_org_id()` / `current_app_user_id()` / `current_user_role()` in Postgres (`docs/database/04_rls_policies.sql`, `11_rls_claims_fallback.sql`).
3. Those helpers read JWT claims when present, otherwise `public.users` via `auth.uid()`.

The browser never receives the service role key. Edge Functions that use the service role call `authorizeCaller()` first and then **ignore client-supplied `orgId`**.

```
User JWT
  → Postgres as role `authenticated`  → RLS (org_id + role)
  → mismo-api (verify_jwt = true)     → authorizeCaller() binds JWT to public.users
```

## Assets

| Asset | Boundary |
|-------|----------|
| Case register, investigations, memos, audit logs, employee directory | Tenant (`org_id`) |
| Prompt responses and deliveries | Tenant, plus employee-own-row rules where SQL says so |
| Anonymous workplace reports | Tenant insert; employees cannot read others' cases |
| Published HR law corpus | Platform-wide read for signed-in users; writes are service-role / privileged sync |
| Invite links, reminder mail, cron | Privileged JWT or `CRON_SECRET`; not tenant-data APIs on `mismo-cron` |

## Actors

- **Employee / client** — least privilege inside one org.
- **HR / admin / manager / super-admin** — org register, not other orgs.
- **Scheduler** — `mismo-cron` with `CRON_SECRET`; no user JWT.
- **Service role** — bypasses RLS. Allowed only in Edge Functions after `authorizeCaller` (or cron secret). Compromise of this key is a full-data incident.

## Attacks this repo tests against

Integration tests in `tests/integration/cross-tenant-rls.test.ts` load those SQL files into a throwaway Postgres, create **two organizations** and four users, then run as role `authenticated` (not superuser). The database is the enforcement point.

| Attempt | Expected database result |
|---------|--------------------------|
| HR A `SELECT` reports/users/audits/memos/investigations | Only org A |
| HR A `SELECT … WHERE org_id = org B` | Empty set (RLS filters; no leak) |
| HR A `INSERT` a report/user/investigation/audit into org B | `new row violates row-level security policy` |
| HR A `UPDATE reports SET org_id = org B` | RLS `WITH CHECK` rejects |
| HR A `UPDATE`/`DELETE` org B's case | Zero rows affected; org B row unchanged |
| Employee A reads org B's case | Empty set |
| JWT contains only `sub`; org resolved from `public.users` | Same isolation as claim-based path |

Unit tests (`tests/authz-policy.test.ts`, `tests/edge-route-auth.test.ts`) lock the TypeScript RBAC model and Edge Function auth catalog to the same rules. They do not replace the database tests.

## What RLS does not do

- **JWT signing.** If an attacker can mint a valid project JWT with another `org_id` claim, `current_org_id()` will trust that claim. The signing key is a trust root. Keep it off the client.
- **Service role.** Queries as service role bypass RLS. That is why it is never shipped to the browser and why mutating Edge routes re-bind the caller.
- **Storage object paths.** Bucket policies are in `docs/database/03_storage.sql`. Guessable keys are still a design risk; do not treat this file as a storage audit.
- **Shared law corpus.** `hr_law_records` is readable by any authenticated user by design (platform content, not tenant case files).
- **Availability / abuse.** Rate limits, phishing of invite links, and insider misuse inside a tenant are operational controls, not RLS.

## Human review

Product workflows (acknowledgement, investigation outcome, case escalation) assume a human in the org. They are not a substitute for the database boundary. A reviewer who can open another tenant's row in SQL has already passed the wrong trust boundary.
