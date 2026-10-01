# LEADATHON 2026 — Landing, Registration & Admin

Single-page landing site, multi-step team registration, challenge-track detail pages,
and an admin back-office with QR check-in. MySQL + Resend, with two interchangeable
backends: Node (Vercel / Node.js hosting) and PHP (plain PHP/FTP hosting) — see
"Deploy" below.

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

## Deploy (PHP / FTP hosting)
The `api/**.js` + `lib/**.js` backend is Node-only. For hosting with no Node runtime
(plain PHP/HTML shared hosting, FTP-only), there's a parallel PHP implementation of the
exact same endpoints: every `api/**.js` has an `api/**.php` twin, and every `lib/*.js`
has a `lib/*.php` twin, sharing the same `schema.sql`. The frontend (`public/*.html`) is
identical either way — it just calls `/api/...` and doesn't care which backend answers.

Requirements on the host: **PHP 8.2+** with the `pdo_mysql`, `gd`, `curl`, and `mbstring`
extensions (standard on Hostinger's PHP hosting). QR codes are generated with
`chillerlan/php-qrcode` (pure PHP, via Composer) — already installed locally into
`vendor/`, which is committed to the repo so **no Composer needs to run on the server**.

Upload layout — the host's document root (e.g. `public_html/`) must contain, as siblings:
```
public_html/
├── index.html, register.html, track.html, admin.html, verify.html, tracks-data.js   (contents of public/)
├── .htaccess        (clean URLs + blocks direct access to lib/, vendor/, schema.sql, .env*)
├── api/             (the api/ folder as-is, with its .php files)
├── lib/             (the lib/ folder as-is — has its own .htaccess denying all direct access)
├── vendor/          (as-is — has its own .htaccess denying all direct access)
└── .env.local       (create this directly on the server via FTP; never commit secrets to git)
```
i.e. upload the *contents* of `public/` flattened into the document root, and `api/`,
`lib/`, `vendor/`, `.htaccess`, `schema.sql` as direct siblings of those files — not
nested under a `public/` folder. Apply `schema.sql` to the MySQL database the host gives
you, then create `.env.local` on the server (via FTP/File Manager) with the same keys as
`.env.example` — plain PHP hosting typically has no project-level environment-variable
panel (unlike Node hosting), so the file is how `lib/env.php` picks up config there.

## Security notes
- Admin APIs require `ADMIN_TOKEN` (Bearer, constant-time compare). DB credentials are only
  held server-side via environment variables, never exposed to client code. QR tokens are
  unguessable and only actionable by an authenticated admin. Never commit `.env.local`.
- Resend in test mode only emails the account owner; verify a domain to email all participants.
