# Mismo marketing site

Public landing site matching the classic Mismo marketing design. Deploy this folder to its own
Vercel project and attach your old marketing domain.

## Local

```bash
cd marketing
npm install
npm run dev
```

Opens on http://localhost:5174

## Deploy on Vercel (attach old domain)

1. In Vercel: **Add New Project** → import this GitHub repo.
2. Set **Root Directory** to `marketing`.
3. Framework: Vite. Build: `npm run build`. Output: `dist`.
4. Add env (optional):
   - `VITE_APP_URL` - URL of the logged-in product app (Sign in link)
   - `VITE_INVITE_EMAIL` - inbox for Request Invitation (default `hello@mismo.com`)
5. After deploy: **Domains** → add your old marketing domain (e.g. `www.mismo.com`).

Keep the product app on a separate project/domain (e.g. `app.mismo.com`).

## Pages

- `/` - Home (hero + engagement band)
- `/features` - Feature grid
- `/pricing` - Custom quote plans
