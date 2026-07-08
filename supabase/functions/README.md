# Deploy Mismo API to Supabase Edge Functions

The production API runs on **Supabase Edge Functions** (`mismo-api`), not in the browser. It reads/writes **Postgres via Supabase** and calls **OpenAI** server-side.

## 1. Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed and logged in
- SQL migrations applied (`docs/database/*.sql`)
- OpenAI API key with available quota

## 2. Link project

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

## 3. Set Edge Function secrets

```bash
supabase secrets set \
  OPENAI_API_KEY=sk-... \
  OPENAI_MODEL=gpt-4.1-mini \
  OPENAI_MAX_TOKENS_OUTREACH=1200 \
  OPENAI_MAX_TOKENS_LAW_RESEARCH=4000
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically in Edge Functions.

## 4. Deploy

```bash
supabase functions deploy mismo-api
```

Health check:

```bash
curl "https://YOUR_PROJECT_REF.supabase.co/functions/v1/mismo-api/health"
```

## 5. Frontend `.env.local`

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_AI_FEATURES_ENABLED=true
```

The app auto-uses `https://YOUR_PROJECT_REF.supabase.co/functions/v1/mismo-api` when `VITE_API_BASE_URL` is unset.

## 6. Local development options

**Option A — Supabase functions locally (matches production):**

```bash
supabase functions serve mismo-api --env-file services/api/.env
# Then set VITE_API_BASE_URL=http://localhost:54321/functions/v1/mismo-api
```

**Option B — Node dev server (legacy):**

```bash
cd services/api && npm run dev
# VITE_API_BASE_URL=http://localhost:3001
```

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | API + Supabase + OpenAI status |
| POST | `/ai/outreach/coach` | Outreach tone coach (OpenAI + Supabase persist) |
| GET | `/hr-laws` | Laws from Supabase |
| GET | `/hr-laws/updates` | Law updates from Supabase |
| POST | `/hr-laws/sync` | Read existing laws (full AI sync via local API) |
| GET | `/hr/next-tasks` | HR queue from Supabase counts + optional AI |

HR next tasks **always load from Supabase** when configured. AI suggestions are additive and fail gracefully if OpenAI quota is exceeded.
