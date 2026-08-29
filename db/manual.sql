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
