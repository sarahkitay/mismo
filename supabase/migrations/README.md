# supabase/migrations

These files are **byte copies** of the production SQL under `docs/database/`, renamed with timestamps so Supabase CLI can apply them in order:

1. Schema and storage (`01`–`03`)
2. Auth bridge (`05`) then RLS (`04`)
3. Optional bootstrap (`06`) — seed/org helpers, not customer data
4. Incremental policy/schema updates (`09`–`22`)

Not copied:

- `07_demo_logins.sql` — local demo accounts
- `08_clear_business_data.sql` — wipe script

After editing a `docs/database/*.sql` file, copy it over the matching `supabase/migrations/*_<name>.sql` file so they stay identical (`tests/migrations-present.test.ts` checks this).
