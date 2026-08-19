# Schedule 3pm unanswered-prompt reminder emails

The scheduler is **`mismo-cron`**, not `mismo-api`. Gateway JWT is off so pg_cron/pg_net can call it. Every request must send `CRON_SECRET`.

## Where secrets go

Put these in **Supabase → Project Settings → Edge Functions → Secrets**
(`supabase secrets set`), never in Vercel, Vite, or `.env.local`.

| Secret | Required | Purpose |
|--------|----------|---------|
| `CRON_SECRET` | yes | Shared secret. pg_cron sends it as `x-cron-secret`. |
| `RESEND_API_KEY` | yes, or emails skip | Sends the reminder mail. |
| `RESEND_FROM` | no | Defaults to `Mismo <noreply@mismo.co>`. |
| `SITE_URL` | recommended | Links in the email (e.g. `https://app.mismo.co`). |
| `DEFAULT_ORG_TIMEZONE` | no | Fallback if the org has no timezone. Defaults to `America/Los_Angeles`. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

Do **not** put `CRON_SECRET` in the frontend. HR can still trigger reminders from a signed-in session via `mismo-api` (`verify_jwt = true` + privileged JWT).

## Cron job (pg_cron + pg_net)

1. Dashboard → **Database → Extensions**: enable `pg_cron` and `pg_net`.
2. Store the same value as Edge secret `CRON_SECRET` in Vault (so SQL never hard-codes it).
3. Run:

```sql
select vault.create_secret('<same value as CRON_SECRET>', 'mismo_cron_secret', 'mismo-cron x-cron-secret');

select cron.unschedule(jobid)
from cron.job
where jobname = 'mismo-prompt-reminders';

select cron.schedule(
  'mismo-prompt-reminders',
  '15 * * * *',  -- every hour at :15; the function no-ops until 3pm org-local
  $$
  select net.http_post(
    url := 'https://obvlmowlzsfttqixaqvj.supabase.co/functions/v1/mismo-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mismo_cron_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Hourly is intentional: orgs can have different timezones. The function only emails after 3:00 PM in that org's timezone, and is idempotent per delivery per day.

## Manual test (after 3pm, this can send real mail)

```bash
curl -X POST "https://obvlmowlzsfttqixaqvj.supabase.co/functions/v1/mismo-cron" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Add `"force": true` in the body (or `?force=1`) only when you intend to send before 3pm.
