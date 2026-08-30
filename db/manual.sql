-- DDL that Drizzle's schema.ts cannot express, applied by hand.
--
-- This project has no migration runner: columns are added to
-- lib/db/schema.ts and applied directly to Neon. Extensions and
-- expression/GIN indexes have no representation in schema.ts at all,
-- so without this file a fresh database or a Neon branch comes up
-- missing them, and the failure is quiet rather than loud — catalogue
-- matching still returns correct rows, just via sequential scans
-- (measured: 19.3s per store pair instead of 0.65s), and the `%`
-- operator errors outright if the extension is absent.
--
-- Every statement is idempotent. Run against any new database:
--   psql "$DATABASE_URL" -f db/manual.sql

-- Trigram similarity, used by lib/matching.ts to match a competitor's
-- catalogue against the user's own products by title.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- The indexed expression must match NORM_TITLE in lib/matching.ts
-- character for character, or the planner will not use these.
CREATE INDEX IF NOT EXISTS tracked_products_title_trgm_idx
  ON tracked_products USING gin (
    (regexp_replace(regexp_replace(lower(coalesce(title, '')), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'))
    gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS discovered_products_title_trgm_idx
  ON discovered_products USING gin (
    (regexp_replace(regexp_replace(lower(coalesce(title, '')), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'))
    gin_trgm_ops
  );

-- Array overlap (&&) for the SKU and barcode match passes.
CREATE INDEX IF NOT EXISTS idx_tracked_skus
  ON tracked_products USING gin (skus);
CREATE INDEX IF NOT EXISTS idx_tracked_barcodes
  ON tracked_products USING gin (barcodes);
CREATE INDEX IF NOT EXISTS idx_discovered_skus
  ON discovered_products USING gin (skus);

-- user_store_prefs (user_id, domain) must be UNIQUE, not merely indexed.
--
-- It was created as a plain btree despite the name, which meant
-- `ON CONFLICT (user_id, domain)` had no unique index to match and
-- failed outright ("no unique or exclusion constraint matching the ON
-- CONFLICT specification"), and nothing stopped duplicate pref rows
-- from being written in the first place.
DROP INDEX IF EXISTS idx_usp_user_domain_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usp_user_domain_unique
  ON user_store_prefs (user_id, domain);

-- One tracked/discovered row per (user, store, product handle).
--
-- Neither table had a unique constraint beyond its primary key, so the
-- `onConflictDoNothing()` on every catalogue insert never fired: each
-- insert generates a fresh UUID, so there was nothing to conflict with.
-- Re-importing a store therefore duplicated its entire catalogue, and
-- each duplicate was then crawled independently. 1,758 duplicate rows
-- carrying 819,025 observations were removed on 2026-08-29; these
-- indexes stop it happening again.
CREATE UNIQUE INDEX IF NOT EXISTS tracked_products_user_store_handle_key
  ON tracked_products (user_id, store_domain, handle);
CREATE UNIQUE INDEX IF NOT EXISTS discovered_products_user_store_handle_key
  ON discovered_products (user_id, store_domain, handle);

-- crawl_jobs has no long-term value and now has a retention sweep
-- (lib/crawler/retention.ts, run at the end of each dispatch). The
-- table had never been pruned and had reached 585,000 rows / 145 MB —
-- larger than the price history it was bookkeeping for. After the
-- initial prune it needs a one-off rewrite to hand the pages back;
-- plain VACUUM only marks them reusable, and steady state is a few MB,
-- so that space would otherwise sit idle forever.
--   VACUUM (FULL, ANALYZE) crawl_jobs;

-- Claim flag for the "setup is ready" email. Both catalogue imports
-- call the notifier when they finish, and if they land in the same
-- instant each sees the other as finished, so both would send. The
-- claim is an UPDATE ... WHERE notified_at IS NULL across the user's
-- rows, which only one caller can win.
ALTER TABLE onboarding_jobs ADD COLUMN IF NOT EXISTS notified_at timestamptz;
