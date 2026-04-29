# Rivlr

Shopify competitor price/inventory tracker. A Webgro Ltd product.

## Status

**Phase 1 — Personal MVP.** Single-password access for the owner. No user accounts, no billing, no public landing yet. See `PROJECT-PLAN.md` (in the design repo) for the full phase plan.

## Stack

- Next.js 16 (App Router, Turbopack default)
- React 19
- Tailwind CSS 4
- Drizzle ORM + Postgres (Neon via Vercel)
- Vercel Cron for daily scheduling
- Deployed on Vercel

## Environment variables

Copy `.env.example` to `.env.local` for local development.

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection. Auto-set by Neon/Vercel integration in prod. Required locally for `drizzle-kit push`. |
| `APP_PASSWORD` | The password the owner enters at `/login`. |
| `SESSION_TOKEN` | Long random string used as the session cookie value. Rotate to invalidate all sessions. |
| `CRON_SECRET` | Long random string. Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` to `/api/crawl/*`. |

Generate the random tokens with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## First-time setup (after deploying)

1. Set the four env vars in the Vercel project settings.
2. Locally, set `DATABASE_URL` to your Neon connection string and run:
   ```bash
   npm run db:push
   ```
   This creates the four Phase 1 tables (`tracked_products`, `price_observations`, `stock_observations`, `crawl_jobs`).
3. Visit `app.rivlr.app/login`, enter `APP_PASSWORD`, and start tracking products.

## Development

```bash
npm run dev    # http://localhost:3000
npm run db:studio   # open Drizzle Studio for inspecting the DB
```

## Architecture — Phase 1

- **`proxy.ts`** — password gate (Next.js 16 renamed `middleware` → `proxy`). Reads `rivlr_session` cookie, validates against `SESSION_TOKEN`, redirects to `/login` if missing.
- **`/login`** — single password form, sets the session cookie via Server Action.
- **`/products/new`** — paste a Shopify URL, server validates by fetching `/products/{handle}.js` once, stores the product + initial observations.
- **`/`** — dashboard listing tracked products with latest price + stock.
- **`/api/crawl/dispatch`** — called daily by Vercel Cron. Selects products needing a crawl, creates jobs, fans out to `/api/crawl/run` in batches of 20.
- **`/api/crawl/run`** — worker. Processes a batch of jobs serially with per-store throttling (1 req/sec).

## Roadmap

See `PROJECT-PLAN.md`. Next phases: real auth (Better Auth), billing (Stripe), admin panel, email alerts (Resend), public landing page.
