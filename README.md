# LEADATHON 2026 — Landing, Registration & Admin

Single-page landing site, multi-step team registration, challenge-track detail pages,
and an admin back-office with QR check-in. Vercel (static + serverless) + MySQL + Resend.

## Pages
- `/` landing · `/register` multi-step team registration · `/track?slug=…` track detail pages
- `/verify` public pass stub (opened by a scanned QR) · `/admin` back-office (token-protected)

## Data (MySQL)
- `registrations` — one row per team · `participants` — one row per member with a secure `qr_token`
- Apply schema: `mysql -h HOST -P PORT -u USER -p DBNAME < schema.sql`
- IDs are generated in app code with `crypto.randomUUID()` and stored as `CHAR(36)` (no DB-side UUID generation needed).

## Flow
1. Team registers → registration + participant rows are created; each participant gets a random
   192-bit `qr_token`; Resend emails each their QR pass (best-effort).
2. Admin opens `/admin`, enters `ADMIN_TOKEN`, sees all teams/participants and stats.
3. Check-in/out per participant (buttons) or by scanning/pasting a QR into the scan box.

## Environment variables (see `.env.example`)
`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (or a single `DATABASE_URL`),
`RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_TOKEN`, `PUBLIC_BASE_URL`. Local dev: put them in
`.env.local` (gitignored).

## Local dev
```bash
npm install
npm run dev      # http://localhost:5173  · admin at /admin
```
The dev server mirrors Vercel: static files + `/api/**` handlers.

## Deploy (Vercel)
1. Import the GitHub repo (framework preset: **Other**, no build command).
2. Add the environment variables above (set `PUBLIC_BASE_URL` to the deployed domain).
3. Deploy. `api/**` become serverless functions automatically.

## Security notes
- Admin APIs require `ADMIN_TOKEN` (Bearer, constant-time compare). DB credentials are only
  held server-side via environment variables, never exposed to client code. QR tokens are
  unguessable and only actionable by an authenticated admin. Never commit `.env.local`.
- Resend in test mode only emails the account owner; verify a domain to email all participants.
