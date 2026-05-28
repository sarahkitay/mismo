# Mismo HR System — Internal QA Report (Production)

**Date:** 2026-05-27  
**Production:** https://mismo-theta.vercel.app/  
**Also verified:** https://mismo-git-main-sarah-kitays-projects.vercel.app/  
**Stack:** React + Vite on Vercel, `localStorage` (`mismo_app_v2`, `mismo_session`)

---

## Executive summary

Mismo is **ready for a guided client demo** on the production deployment after merging HR lifecycle fixes to `main` (`adc6193`, `e231a10`, and follow-up commits). Core flows work: **incident prompt → case → investigation → employee visibility → outcome**. Several capabilities remain **simulated or client-side only** and must be disclosed in demos.

**Demo logins:** `employee@mismo.com` · `hr@mismo.com` (email only, no password)

---

## Deployment alignment

| Item | Status |
|------|--------|
| `main` merged with QA branch | Done |
| Production bundle includes incident-Yes→case | Verified (`Incident query — concern` in JS bundle) |
| Baseline “old” behavior (Yes = log only) | Replaced on production |

---

## Scenario results (A–J) — production

| Scenario | Expected | Result | Notes |
|----------|----------|--------|-------|
| **A** | No → logged, no case, gate dismisses | **PASS** (after `e231a10+`) | `heroPromptAlreadyAnswered` hides gate after `finalizedAt` response |
| **B** | Yes → case, HR alert, intake | **PASS** | Case summary **Incident query — concern indicated**; not financial screening text |
| **C** | Wage/hour case `WH-*` | **PASS** | Sidebar → screening → intake |
| **D** | Admin → investigation shell | **PASS** | Case register → Convert; linked report in workspace |
| **E** | Shared + internal notes | **PASS** | Interviews & Notes modules |
| **F** | Employee responds to HR request | **PASS** | Seed: `report-outcome-test` / `inv-outcome-demo` for **Alex Morgan** (`employee@mismo.com`) |
| **G** | Outcome acknowledgement | **PASS** | Same demo report; agree/disagree tracked |
| **H** | Employee profile history | **PASS** | HR → Employees → **Alex Morgan** — tabs Overview, Reports, Prompt Responses, Memos, Investigations, Outreach, Timeline |
| **I** | Memo ack / clarification | **PASS** | Button flow + signature after “read and understood” |
| **J** | CSV export | **PASS** | Case Register → **Export CSV**; Analytics export; PDF stubbed in Report Builder |

---

## Core flow checklist

### 1. Employee prompts (permanent)
- Incident query: calm EQC-style copy, Yes confirmation step, No/Yes both finalize with timestamp  
- Yes → `WORKPLACE_INVESTIGATION` case (`IR-YYYY-####`), optional pay screening note in **ledger only**  
- Wage & hour channel: separate permanent route; covers pay, OT, hours, classification, deductions, benefits  
- No duplicate case on screening No (`recordWageHourScreeningNo`)

### 2. Employee portal
- Home: mandatory gate when due; relaxed dashboard after completion  
- Single **Report a concern** section (two channels: workplace + wage/hour)  
- My Reports clickable; employee-safe fields only  
- Internal investigation notes hidden

### 3. Admin dashboard
- All metric cards and action lines navigate to filtered views  
- No dead widgets observed

### 4. Employee profile (admin)
- Full history tabs; linked records clickable  
- Witness / investigation involvement via investigation persons + reports

### 5. Case register
- Table, filters, bulk actions, CSV export  
- Employee → profile; investigation links

### 6. Investigation (3-page workflow — `cursor/investigation-three-page-bb68`)
- **Page 1 — Intake & assignment:** Unified case ID (`CAS-YYYY-####` / `WH-YYYY-####`) matches report + EI form; auto reporter/source/date; admin assign; read-only employee submission; initial contact notes  
- **Page 2 — Gather:** Persons table (search + roles + profile links); interviews/requests; evidence; policy/memo read status at complaint date; legal involvement flag  
- **Page 3 — Outcome:** Findings, resolution, outcome letter, export/close  
- Legacy 8-tab URLs redirect to pages; industry checklist on report detail collapsed by default (investigation is primary path)  
- Wage & hour prompt: spec copy, YES confirm (BACK/SUBMIT), admin alert on submit

### 7–11. Wage/hour, memos, analytics, access, audit
- See prior sections; audit entries on prompt response, case create, investigation create, wage screening, exports (activity log)

---

## Fixes shipped (this initiative)

1. **Incident Yes opens case** — `submitIncidentPromptYes` / `beginIncidentCaseFromPrompt`  
2. **Audit trail** on prompt responses and investigation creation  
3. **Employee in-app** response to HR `responseRequests`  
4. **Investigator shared notes** UI  
5. **Post-check-in gate flash** — hide gate when response `finalizedAt` exists  
6. **Case titles** — summary-first headlines; financial screening stays on prompt response / ledger  
7. **Scenario F seed** — pending request on `inv-outcome-demo`  
8. **Convert NEW cases** to investigation from register  
9. **3-page investigation + unified case ID** — prompt/self-report allocates `CAS-*`/`WH-*` once; investigation inherits same ID; EI form shows reference  
10. **Dashboard & register feedback** — grouped response buckets (incident / wage-hour / memos / case register), status tiles on register, alphabetical prompt sort, dashboard metrics (resolved, avg resolution, active memos), memo list ID + active status, sidebar prompts link, activity route wired  

---

## Still stubbed / simulated

| Area | Status |
|------|--------|
| Auth | Email picker only |
| Email/SMS alerts | Toast “simulated” |
| PDF export | Stub in Report Builder |
| Data | Browser `localStorage` — not multi-user server |
| RBAC | Not server-enforced |
| Investigator login | HR users run investigations |
| CLIENT role | Limited dashboard |

---

## Backend integration priorities

1. API + database + immutable audit log  
2. Auth (SSO) + role claims  
3. Notification service  
4. Blob storage for evidence  
5. PDF generation service  

---

## Known limitations for demos

- Clear `localStorage` between demos for a clean prompt: DevTools → `localStorage.removeItem('mismo_app_v2')` + `mismo_session` → reload  
- **Alex Morgan** = `employee@mismo.com`; use **Demo: outcome letter** for scenarios F/G  
- Do not claim production-complete while PDF, email, and server persistence are stubbed  

---

## Recommended demo script (15 min)

1. Employee: incident **No** → dashboard clears  
2. Employee: incident **Yes** → intake → My Reports  
3. Employee: wage/hour **Yes** → submit intake  
4. HR: dashboard → Yes responses / Case register  
5. HR: convert case → investigation → shared note  
6. Employee: demo outcome report → respond / acknowledge  
7. HR: Alex Morgan profile → export employee CSV  

---

*Last updated after production re-audit on mismo-theta.vercel.app.*
