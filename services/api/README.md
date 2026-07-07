# @mismo/api

Server-side API for Mismo (AWS Lambda + local dev). **OpenAI keys stay here only.**

## Handlers

| File | Trigger | Purpose |
|------|---------|---------|
| `handlers/outreach-coach.ts` | POST `/ai/outreach/coach` | Tone analysis 1–6 + suggested rewrite |
| `handlers/hr-law-sync.ts` | EventBridge weekly | Research state HR laws via OpenAI |
| `handlers/hr-law-notify.ts` | EventBridge daily | Send law update alerts |

## Local dev

```bash
cd services/api
npm install
cp .env.example .env   # if .env does not exist yet — then edit .env
npm run dev
```

Then set in root `.env.local`:

```
VITE_API_BASE_URL=http://localhost:3001
VITE_AI_FEATURES_ENABLED=true
```

## Deploy (SAM)

```bash
cd services/api && npm run build
cd ../../infra
sam build
sam deploy --guided
```

See `docs/OPENAI_HR_ASSISTANT.md` and `docs/AWS_PLATFORM_ARCHITECTURE.md`.
