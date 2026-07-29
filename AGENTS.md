# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Mismo is a frontend-only React SPA (Employee Protection & Compliance Platform) built with Vite + TypeScript + Tailwind CSS + shadcn/ui. No backend, database, or external services are required. All state is persisted to browser `localStorage` (key: `mismo-app-state-v1`) with mock seed data.

### Running the app

- **Dev server**: `npm run dev` → serves on http://localhost:5173
- **Build**: `npm run build` (runs `tsc -b && vite build`)
- **Lint**: `npm run lint` (ESLint 9 — note: the codebase has pre-existing lint errors that are not blocking)
- **Type check only**: `npx tsc -b` (exits cleanly)

### Demo login credentials

The app has a local demo login system (no real auth). Use these emails on the login page:
- `employee@mismo.com` — Employee portal
- `hr@mismo.com` — HR/Admin portal

Password is not validated; any value works for the mock system.

### Portal switching

Use the "View as" dropdown (top-right) to switch between Human Resources, Client View, and Employee views without logging out.

### Key notes

- No `.env` file is needed; no secrets or API keys required.
- The `node_modules` directory is not committed; run `npm install` after cloning.
- Vite HMR works normally — file changes reflect immediately in the browser.
