# Deploy and schema application

This repository is sanitized: it does not contain production secrets, customer data, or live environment dashboards. Reviewers can still inspect **how** the app is meant to be deployed.

## Web app (Vercel)

- Vite SPA. `vercel.json` rewrites non-asset paths to `index.html`.
- Build: `npm ci && npm run build`.
- Browser env (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Never put `CRON_SECRET`, the service role key, or OpenAI keys in Vercel/Vite.

CI (`.github/workflows/ci.yml`) runs `npm test` (including throwaway-Postgres RLS) then `npm run build` on every push to `main`.

## Database

Canonical SQL lives in `docs/database/`. The same files are copied into `supabase/migrations/` in apply order so `supabase db push` / migration history is reviewable.

Skip `07_demo_logins.sql` (local demo only) and `08_clear_business_data.sql` (destructive) in production.

Local/reviewer apply:

```bash
# linked to a non-production project
supabase db push
```

Or run the numbered files in `docs/database/README.md` order against a review database. Do not point `tests/integration` at production (`DATABASE_URL` must be a throwaway database).

## Edge Functions

```bash
supabase functions deploy mismo-api
supabase functions deploy mismo-cron
```

- `mismo-api`: `verify_jwt = true`. Secrets: service role (platform-managed), OpenAI if AI is enabled, mail provider if notifications are enabled.
- `mismo-cron`: `verify_jwt = false`; requires `CRON_SECRET`. Scheduler must send that secret. User data routes are not registered on this function.

See `supabase/config.toml`, `docs/ARCHITECTURE.md`, and `docs/database/23_prompt_reminders_cron.md`.
