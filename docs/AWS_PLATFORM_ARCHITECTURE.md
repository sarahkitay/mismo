# AWS Platform Architecture — Mismo

End-to-end production layout: React SPA, API, RDS, AI jobs, file storage, and notifications.

---

## High-level topology

```
                    ┌─────────────────────────────────────┐
                    │           Route 53 (optional)        │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              │                                               │
     ┌────────▼────────┐                           ┌──────────▼──────────┐
     │  CloudFront     │                           │  API Gateway (HTTP)   │
     │  + S3 (static)  │                           │  + Lambda (Node 20)   │
     │  React build    │                           │  services/api         │
     └─────────────────┘                           └──────────┬──────────┘
                                                              │
                    ┌─────────────────────────────────────────┼─────────────────────────┐
                    │                                         │                         │
           ┌────────▼────────┐                    ┌─────────▼─────────┐    ┌─────────▼─────────┐
           │  RDS PostgreSQL │                    │  Secrets Manager   │    │  OpenAI API       │
           │  + RDS Proxy    │                    │  DB + OpenAI keys  │    │  (external)       │
           └────────┬────────┘                    └───────────────────┘    └───────────────────┘
                    │
           ┌────────▼────────┐         ┌──────────────────┐         ┌──────────────────┐
           │  S3 files       │         │  EventBridge     │         │  SES / SNS       │
           │  attachments    │         │  cron triggers   │         │  email + SMS     │
           └─────────────────┘         └──────────────────┘         └──────────────────┘
```

---

## Service map

| Concern | AWS service | Notes |
|---------|-------------|-------|
| Static app | S3 + CloudFront | `npm run build` → sync `dist/` |
| API | API Gateway HTTP API + Lambda | See `infra/template.yaml` |
| Database | RDS PostgreSQL 15+ | Schema: `docs/AWS_RDS_POSTGRES_SCHEMA.sql` + AI migration |
| Pooling | RDS Proxy | Required if many concurrent Lambdas |
| Secrets | Secrets Manager | `mismo/{env}/database`, `mismo/{env}/openai` |
| Files | S3 `mismo-{env}-files` | Presigned upload/download |
| Auth | Cognito (recommended) | Maps to `auth_credentials.cognito_sub` |
| Cron | EventBridge | Daily prompts, HR law sync, notifications |
| Email | SES | Law updates, case outreach (after HR sends) |
| AI | Lambda → OpenAI | No OpenAI from browser |
| Logs | CloudWatch | Lambda + API access logs |
| WAF | AWS WAF on CloudFront | Rate limit `/ai/*` |
| IaC | AWS SAM (`infra/`) | Or Terraform/CDK equivalent |

---

## Deployment phases

### Phase 0 — Current (demo)

- Vite SPA on Vercel or S3  
- `localStorage` via `useDataStore.ts`  
- No backend  

### Phase 1 — Data on AWS

1. Provision RDS; run both SQL files  
2. Deploy CRUD API Lambda (reports, prompts, users)  
3. Swap `useDataStore` persistence for `fetch('/api/...')`  
4. S3 for attachments  

### Phase 2 — AI services (this prep)

1. Deploy AI Lambdas from `services/api`  
2. EventBridge: `hr-law-sync`, `hr-law-notify`  
3. Enable `OutreachToneCoach` in admin UI  
4. Compliance hub: state law browser + update feed  

### Phase 3 — Hardening

- Cognito + JWT authorizer on API Gateway  
- RLS enabled on RDS  
- VPC Lambda → RDS (private subnets)  
- OpenAI Vector Store for law RAG  

---

## Secrets Manager shape

**`mismo/prod/database`**

```json
{
  "host": "mismo.xxxx.us-west-2.rds.amazonaws.com",
  "port": 5432,
  "dbname": "mismo",
  "username": "mismo_app",
  "password": "..."
}
```

**`mismo/prod/openai`**

```json
{
  "apiKey": "sk-...",
  "organization": "org-...",
  "defaultModel": "gpt-4.1"
}
```

Lambda IAM role needs `secretsmanager:GetSecretValue` on these ARNs.

---

## EventBridge rules

| Rule | Schedule | Target |
|------|----------|--------|
| `mismo-daily-prompts` | `cron(0 12 * * ? *)` | `prompt-delivery-generator` |
| `mismo-hr-law-sync` | `cron(0 6 ? * MON *)` | `hr-law-sync` |
| `mismo-hr-law-notify` | `cron(0 14 * * ? *)` | `hr-law-notify` |

---

## API routes (planned)

| Method | Path | Handler |
|--------|------|---------|
| GET | `/health` | health |
| POST | `/ai/outreach/coach` | outreach-coach |
| GET | `/hr-laws?state=CA&topic=WAGE_HOUR` | list laws |
| GET | `/hr-laws/updates` | recent changes |
| PUT | `/org/hr-law-watchlist` | admin config |
| * | `/reports`, `/prompts`, … | Phase 1 CRUD |

---

## Frontend env (build-time)

```bash
VITE_API_BASE_URL=https://api.mismo.example.com
VITE_AI_FEATURES_ENABLED=true
VITE_AWS_REGION=us-west-2
```

---

## Local development

```bash
# Terminal 1 — SPA
npm run dev

# Terminal 2 — API (when implemented)
cd services/api && npm run dev

# Uses .env.local with OPENAI_API_KEY for local coach testing only
# Never commit real keys
```

With `VITE_API_BASE_URL` unset, `aiServices.ts` returns **mock coach responses** so UI works offline.

---

## Cost controls

- Cap OpenAI `max_tokens` per job type in `services/api/src/lib/openai.ts`  
- Batch state research (5 states per Lambda invocation, Step Functions for full 50)  
- Cache law list in RDS; only re-research when hash stale or weekly  
- CloudWatch alarm on `ai_job_runs` failure rate  

---

## Migration order

1. `AWS_RDS_POSTGRES_SCHEMA.sql`  
2. `AWS_RDS_AI_LAWS_MIGRATION.sql`  
3. `sam deploy --guided` from `infra/`  
4. Set org watchlist + test coach on staging  
5. Enable production EventBridge rules  

See also: [`AWS_DATABASE_SETUP.md`](./AWS_DATABASE_SETUP.md), [`OPENAI_HR_ASSISTANT.md`](./OPENAI_HR_ASSISTANT.md).
