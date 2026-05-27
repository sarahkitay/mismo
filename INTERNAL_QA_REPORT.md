# Mismo HR System — Internal QA Report

**Date:** 2026-05-27 (re-audit after merge to `main`)  
**Scope:** End-to-end HR lifecycle (employee prompts → cases → investigations → outcomes → reporting)  
**Production URLs tested:**
- https://mismo-theta.vercel.app/ (primary)
- https://mismo-git-main-sarah-kitays-projects.vercel.app/ (main branch preview)
- https://mismo-i17f8kfxx-sarah-kitays-projects.vercel.app/ (deployment preview)

**Environment:** Vite static deploy on Vercel, `localStorage` persistence (`mismo_app_v2`, `mismo_session`)

**Baseline:** Production previously matched `main` without incident-Yes→case wiring; fixes merged to `main` at `adc6193`+.

---

## Executive summary

Mismo is **client-demo ready** for the core HR lifecycle when exercised through the primary flows below. This pass fixed a critical gap where **incident prompt “Yes” logged a response but did not open a case**, and added **employee in-app response** plus **investigator shared notes**. Several areas remain **frontend-only stubs** or need **backend integration** before production claims.

---

## What worked (verified)

### 1. Employee prompt flow
| Check | Result |
|-------|--------|
| Incident prompt — answer **No** | PASS — response logged, calm confirmation, no case in My Reports |
| Incident prompt — answer **Yes** | PASS (after fix) — case shell `IR-YYYY-####`, HR notified (toast + activity), intake form offered |
| Go back before final submit | PASS — incident Yes uses confirmation step; wage/hour allows back before intake submit |
| Wage & hour permanent channel | PASS — screening No logs acknowledgement without case; Yes opens `WH-*` case and intake |
| Calm / non-threatening incident copy | PASS — retaliation note, confirmation step |
| Wage/hour coverage (pay, OT, hours, classification, deductions, benefits) | PASS — screening question + issue-type checklist |

### 2. Employee portal
| Check | Result |
|-------|--------|
| Mandatory check-in gate on Home | PASS |
| Report a concern (two channels, not duplicated in nav) | PASS — section on Home + sidebar wage/hour; distinct purposes |
| My Reports rows clickable | PASS |
| Employee sees status, not internal HR notes | PASS — `INTERNAL` notes filtered out |
| Memo acknowledgement (buttons + signature after read) | PASS — `MemoSignatureAcknowledgement` |
| Shared investigator updates | PASS |

### 3. Admin dashboard
| Check | Result |
|-------|--------|
| Action Required lines → filtered registers | PASS |
| Metric cards (Yes / investigations / memos / at-risk) | PASS |
| Chart headers → registers | PASS |
| Manage prompts / memos / analytics shortcuts | PASS |

### 4. Case register
| Check | Result |
|-------|--------|
| Table layout, search, filters | PASS |
| Row → detail; employee name → profile | PASS |
| Bulk actions + CSV export | PASS |
| Convert **NEW** cases to investigation (fixed) | PASS |

### 5. Investigation workflow
| Check | Result |
|-------|--------|
| Guided modules (8 stages, not one giant checklist) | PASS |
| Case/report IDs, source type, linked report | PASS |
| Evidence upload, persons involved, internal vs shared notes | PASS |
| Outcome to employee + acknowledgement | PASS (seed `report-outcome-test`) |
| Closure / audit export CSV | PASS (PDF labeled stub) |

### 6. Employee profile (admin)
| Check | Result |
|-------|--------|
| Tabs: Overview, Reports, Prompt Responses, Memos, Investigations, Outreach, Timeline | PASS |
| Clickable links to cases / investigations | PASS |

### 7. Access control (demo)
| Check | Result |
|-------|--------|
| Employee cannot see other employees’ reports | PASS (scoped by `createdByUserId`) |
| HR sees full registers | PASS |
| Role switch via login email + “View as” preview | PASS (demo only — not production RBAC) |

### 8. Audit trail (demo)
| Check | Result |
|-------|--------|
| Prompt response logged | PASS (added `auditLogs` on submit) |
| Case creation from prompt Yes | PASS |
| Investigation creation | PASS (added audit entries) |
| Wage/hour screening / intake | PASS (existing) |

---

## Scenario matrix (A–J)

| Scenario | Result | Notes |
|----------|--------|-------|
| **A** No on incident prompt | **PASS** | Analytics/counts update via new response row |
| **B** Yes + details | **PASS** | Case + intake; admin sees in register / yes-responses queue |
| **C** Wage/hour concern | **PASS** | Separate case type and status `PENDING_WAGE_HOUR_REVIEW` |
| **D** Admin → investigation | **PASS** | Shell preserves source; linked report in workspace |
| **E** Intake, persons, evidence, internal + shared notes | **PASS** | Timeline via activities + stage history |
| **F** Employee responds to HR request | **PARTIAL** | UI implemented; requires HR to send **Response request** first (seed has submitted example on `inv-1` only) |
| **G** Findings / outcome / closure | **PASS** | Use `report-outcome-test` / Findings module |
| **H** Employee report (admin profile) | **PASS** | |
| **I** Memo create / ack / clarification | **PASS** | |
| **J** Export CSV | **PASS** | PDF export explicitly stubbed in Report Builder |

---

## What broke (before this pass) — **fixed**

1. **Incident prompt “Yes”** recorded only a prompt response; **no case** appeared in register or My Reports.  
   **Fix:** `submitIncidentPromptYes` + `beginIncidentCaseFromPrompt` in `useDataStore.ts`; `EmployeeHome` navigates to `incident-intake/{id}`.

2. **Prompt responses** did not write to **`auditLogs`**.  
   **Fix:** Audit entry on every `submitPromptResponse`.

3. **Bulk “Convert to investigation”** skipped `NEW` cases.  
   **Fix:** Allow conversion for all unlinked reports.

4. **`sourcePromptResponseId`** on manual report form used **delivery id** instead of response id.  
   **Fix:** Resolve from `responses` by `promptDeliveryId`.

5. **No investigator “shared note”** UI; **no employee reply** to in-app requests.  
   **Fix:** Shared note module in Interviews & Notes; `submitEmployeeInvestigationResponse` on employee report detail.

---

## What remains stubbed / simulated

| Area | Status |
|------|--------|
| Authentication | Email-only login; no SSO/password/MFA |
| Email/SMS alerts | Toasts copy says “simulated” |
| PDF export | Stub label in Report Builder / investigation closure |
| Persistence | `localStorage` only — no multi-user server state |
| RBAC | Role from session + demo switcher — not enforced server-side |
| File evidence | Base64 in browser; 5 MB demo cap |
| AI guidance panels | Placeholder copy, not connected to models |
| Real-time notifications | None |
| Multi-tenant isolation | Org id in data model; single org in demo seed |

---

## Backend integration needed (priority)

1. **API + database** for users, orgs, cases, investigations, audit (immutable log).
2. **Auth** (SSO, session, role claims) replacing email picker.
3. **Notification service** (email/SMS) for prompt Yes, case assignment, outcome letters.
4. **Blob storage** for evidence and memo attachments with virus scan + retention.
5. **Export service** for PDF audit packets and compliance reports.
6. **Workflow engine** for stage gates, SLAs, and assignment rules.

---

## Known limitations

- Clearing `localStorage` resets all beta data (document for client demos).
- Financial follow-up on incident prompt logs compensation screening on the **prompt response**; a separate **wage/hour case** is only created via the dedicated Wage & Hour channel (by design).
- Investigator role is not a separate login; HR users own investigations.
- Client admin (`CLIENT` role) dashboard is analytics-oriented, not full case management.

---

## Recommended next build priority

1. Backend API + Postgres (or equivalent) with audit log table.  
2. Real auth and role enforcement.  
3. Notification pipeline for prompt Yes / case assigned / outcome sent.  
4. Seed **pending** `responseRequests` in API for Scenario F demos.  
5. PDF export service.  
6. Visual polish pass after data layer is stable.

---

## Files changed in this QA pass

- `src/hooks/useDataStore.ts` — case from incident Yes, audit, employee investigation response  
- `src/pages/employee/EmployeeHome.tsx` — Yes → case + intake navigation  
- `src/pages/employee/NewReport.tsx` — correct prompt response linkage  
- `src/pages/employee/ReportDetail.tsx` — HR request response UI  
- `src/pages/admin/AdminCaseRegisterHub.tsx` — convert NEW cases  
- `src/components/admin/investigation/InvestigationWorkflowPages.tsx` — shared notes  
- `src/types/index.ts` — `finalizedAt`, `responseText`

---

*This report reflects actual browser testing and code audit. Do not mark production-complete until stubs above are replaced or explicitly accepted by the client.*
