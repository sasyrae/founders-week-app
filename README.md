# Flybridge Founders Week & AGM — registration app

Production web app for **Flybridge Founders Week & AGM · October 14–16, 2026 · The William Vale, Brooklyn.**

Ported from the approved prototype (`flybridge-founders-week-app.jsx`) to real infrastructure:

- **Next.js** (App Router) — deployed on **Vercel**
- **Supabase** (Postgres) — data
- **Resend** — confirmation emails (sent instantly on registration)
- **Slack** incoming webhook — optional cross-post of admin updates

## What it does

- **Attendees:** three-day agenda with per-session registration, a registration form (days, hotel + nights, dietary), a post-registration welcome, "Find my registration," edit registration, an Updates feed, and the Good Eats guide.
- **Access-gated sessions:** the AGM Private Session requires an access code, validated **server-side** (the code never ships to the browser).
- **Host tools** (`Host tools` link in the footer, password-protected): Check-in, Registrants (room-block tracker, catering, CSV export), Confirmations (template editor + resend), Send update (+ Slack), Sessions editor, Settings.

## Environment variables

Copy `.env.local.example` to `.env.local` for local development, and set the **same names** in Vercel → Project → Settings → Environment Variables for production.

| Variable | What it is | Secret? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | no |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (full DB access) | **yes** |
| `ADMIN_PASSWORD` | Password for Host tools | **yes** |
| `ADMIN_SESSION_SECRET` | Random string used to sign the admin login cookie | **yes** |
| `RESEND_API_KEY` | Resend API key | **yes** |
| `CONFIRM_FROM_EMAIL` | Verified from-address, e.g. `Flybridge Founders Week <founders-week@flybridge.com>` | no |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook (leave blank to disable cross-post) | **yes** |
| `NEXT_PUBLIC_SITE_URL` | The public site URL | no |

## Database setup

In the Supabase project, open the **SQL Editor** and run [`db/schema.sql`](db/schema.sql) once. It creates the tables and locks them down with Row Level Security (only the server, using the service-role key, can read/write). The agenda content **seeds itself automatically** on first load from `lib/constants.js`.

## Local development

```bash
npm install
cp .env.local.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000. The Host tools are at the **Host tools** link in the footer.

## Deploying

This repo is wired to Vercel via GitHub — pushing to `main` triggers a deploy. Set the environment variables in the Vercel dashboard.

## Security notes

- All database access is server-side via the service-role key; the browser never talks to Supabase directly, and every table has RLS enabled with no policies.
- Session access codes live on the server and are stripped from the public API.
- The admin password is checked server-side and never shipped to the client; login sets a signed, httpOnly cookie.
