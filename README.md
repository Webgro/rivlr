# Rivlr

Shopify competitor price/inventory tracker. A Webgro Ltd product.

## Status

**Phase 3 — Multi-user.** Magic-link sign-in, per-user data scoping. No
billing yet (that's Phase 4 — Stripe). See `PROJECT-PLAN.md` (in the
design repo) for the full phase plan.

## Stack

- Next.js 16 (App Router, Turbopack default)
- React 19
- Tailwind CSS 4
- Drizzle ORM + Postgres (Neon via Vercel)
- Resend for transactional email (magic links, alerts, digests)
- Vercel Cron for daily scheduling
- Deployed on Vercel

## Environment variables

Copy `.env.example` to `.env.local` for local development.

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection. Auto-set by Neon/Vercel integration in prod. Required locally for `drizzle-kit push`. |
| `CRON_SECRET` | Long random string. Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` to `/api/crawl/*`. |
| `RESEND_API_KEY` | Resend key. Required for magic-link sign-in emails and alert/digest sending. |
| `RESEND_FROM` | The `From` address. Must be from a domain verified in your Resend account. Defaults to `alerts@rivlr.app`. |

Generate the random tokens with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## First-time setup (after deploying)

1. Set the env vars in the Vercel project settings.
2. Locally, set `DATABASE_URL` to your Neon connection string and run:
   ```bash
   npm run db:push
   ```
3. Visit `rivlr.app/login`, enter your email, click the magic link in
   the inbox. The first verified user adopts any pre-existing data.
   Subsequent unknown emails are rejected (single-account mode).

## Development

```bash
npm run dev    # http://localhost:3000
npm run db:studio   # open Drizzle Studio for inspecting the DB
```

## Architecture — Phase 3

- **`proxy.ts`** — gates the dashboard behind a `rivlr_auth` cookie.
  Cookie presence is checked at the edge; full session validation
  (DB row + sliding 30-day expiry) happens in route handlers via
  `getSession()`.
- **`/login`** — email-only form. Sends a magic link via Resend.
- **`/auth/verify`** — consumes the link, creates an `auth_sessions`
  row, and on first-ever signup runs `migrateLegacyDataForUser` to
  adopt all pre-existing rows.
- **`/products/new`** — paste a Shopify URL or collection. All inserts
  carry `user_id`.
- **`/dashboard`** — the user's own dashboard. Every query is
  `WHERE user_id = ?`-scoped.
- **`/api/crawl/*`** — Vercel Cron entrypoints. Crawl observations are
  store-level (no user awareness needed), but discovery + emails fan
  out per user.

## Roadmap

See `PROJECT-PLAN.md`. Next phase: Stripe billing + plan gating.
