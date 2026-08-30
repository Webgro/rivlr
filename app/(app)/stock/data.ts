import { db } from "@/lib/db";
import { sql, type SQL } from "drizzle-orm";

/**
 * The Stock page's data layer, shared with /api/stock/export so the
 * spreadsheet and the screen can never drift apart.
 *
 * A product counts as "sold by me" when its match group also holds a
 * product from one of the owner's own shops. Own shops come from
 * `user_store_prefs.is_my_store`, the per-user source of truth.
 * `stores.is_my_store` is a stale global flag and is never read.
 *
 * The own-shop product is picked with a LATERAL, one per rival row, so a
 * group holding two of the owner's products cannot duplicate a rival.
 *
 * A rival being out of stock is the whole point of the page, so those
 * rows sort to the top. Sorting happens in SQL because the list is
 * paginated and sorting one page would only sort within that page. The
 * units-sold expression mirrors lib/velocity.ts; the printed values come
 * from getVelocity, called once for the page.
 */

export const STOCK_PAGE_SIZE = 50;
export const WINDOW_DAYS = 7;
/** Mirrors MIN_READINGS in lib/velocity.ts — keep the two in step. */
const MIN_READINGS = 3;

export interface StockFilters {
  /** Free text against either product name or the rival shop. */
  q?: string;
  /** Only rivals that are currently out of stock. */
  out?: boolean;
  /** Only rivals on this shop. */
  shop?: string;
}

export interface StockRow {
  id: string;
  storeDomain: string;
  handle: string;
  title: string | null;
  currency: string;
  price: number | null;
  available: boolean | null;
  quantity: number | null;
  myId: string;
  myTitle: string | null;
  myHandle: string;
  myImageUrl: string | null;
}

type Raw = {
  id: string;
  store_domain: string;
  handle: string;
  title: string | null;
  currency: string;
  latest_price: string | null;
  latest_available: boolean | null;
  latest_quantity: number | null;
  my_id: string;
  my_title: string | null;
  my_handle: string;
  my_image_url: string | null;
  total_count: number;
  out_count: number;
};

/**
 * Rival products that sit in a match group alongside one of the owner's
 * own products. Shared by every query below so they can never disagree
 * about which rows belong on this page.
 */
function candidatesCte(userId: string): SQL {
  return sql`
    SELECT
      c.id, c.store_domain, c.handle, c.title, c.currency,
      c.latest_price, c.latest_available, c.latest_quantity,
      m.id AS my_id,
      m.title AS my_title,
      m.handle AS my_handle,
      m.image_url AS my_image_url
    FROM tracked_products c
    JOIN LATERAL (
      SELECT mp.id, mp.title, mp.handle, mp.image_url
      FROM tracked_products mp
      JOIN user_store_prefs usp2
        ON usp2.user_id = ${userId}::uuid
       AND usp2.domain = mp.store_domain
       AND usp2.is_my_store = true
      WHERE mp.user_id = ${userId}::uuid
        AND mp.active = true
        AND mp.group_id = c.group_id
      ORDER BY mp.added_at ASC
      LIMIT 1
    ) m ON true
    WHERE c.user_id = ${userId}::uuid
      AND c.active = true
      AND c.group_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM user_store_prefs usp
        WHERE usp.user_id = ${userId}::uuid
          AND usp.domain = c.store_domain
          AND usp.is_my_store = true
      )
  `;
}

function filterClause(filters: StockFilters): SQL {
  const parts: SQL[] = [];
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    const like = `%${q}%`;
    parts.push(sql`AND (
      LOWER(COALESCE(c.my_title, '')) LIKE ${like}
      OR LOWER(c.my_handle) LIKE ${like}
      OR LOWER(COALESCE(c.title, '')) LIKE ${like}
      OR LOWER(c.store_domain) LIKE ${like}
    )`);
  }
  if (filters.out) parts.push(sql`AND c.latest_available = false`);
  if (filters.shop) parts.push(sql`AND c.store_domain = ${filters.shop}`);
  return parts.length === 0
    ? sql.empty()
    : parts.reduce((acc, p) => sql`${acc} ${p}`);
}

/**
 * Rows for the page or the export.
 *
 * `page` is optional: leave it off and every matching row comes back,
 * which is what the CSV wants.
 */
export async function getStockRows(
  userId: string,
  filters: StockFilters = {},
  page?: { limit: number; offset: number },
): Promise<{ rows: StockRow[]; totalCount: number; outCount: number }> {
  const limitClause = page
    ? sql`LIMIT ${page.limit} OFFSET ${page.offset}`
    : sql.empty();

  const result = await db.execute<Raw>(sql`
    WITH candidates AS (${candidatesCte(userId)}),
    matching AS (
      SELECT c.* FROM candidates c WHERE true ${filterClause(filters)}
    ),
    deltas AS (
      SELECT
        so.product_id,
        so.quantity,
        LAG(so.quantity) OVER (
          PARTITION BY so.product_id ORDER BY so.observed_at
        ) AS prev
      FROM stock_observations so
      JOIN matching c ON c.id = so.product_id
      WHERE so.quantity IS NOT NULL
        AND so.observed_at > now() - MAKE_INTERVAL(days => ${WINDOW_DAYS})
    ),
    sold AS (
      SELECT
        product_id,
        COALESCE(SUM(GREATEST(prev - quantity, 0)), 0)::int AS units_sold,
        COUNT(*)::int AS readings
      FROM deltas
      WHERE prev IS NOT NULL
      GROUP BY product_id
    )
    SELECT
      c.id, c.store_domain, c.handle, c.title, c.currency,
      c.latest_price, c.latest_available, c.latest_quantity,
      c.my_id, c.my_title, c.my_handle, c.my_image_url,
      (COUNT(*) OVER ())::int AS total_count,
      (SUM(CASE WHEN c.latest_available = false THEN 1 ELSE 0 END)
        OVER ())::int AS out_count
    FROM matching c
    LEFT JOIN sold s ON s.product_id = c.id
    ORDER BY
      CASE WHEN c.latest_available = false THEN 0 ELSE 1 END ASC,
      CASE WHEN s.readings >= ${MIN_READINGS} THEN s.units_sold ELSE 0 END DESC,
      LOWER(COALESCE(c.my_title, c.my_handle)) ASC
    ${limitClause}
  `);

  const raw = Array.from(result);
  return {
    rows: raw.map((r) => ({
      id: r.id,
      storeDomain: r.store_domain,
      handle: r.handle,
      title: r.title,
      currency: r.currency,
      price: r.latest_price !== null ? Number(r.latest_price) : null,
      available: r.latest_available,
      quantity: r.latest_quantity,
      myId: r.my_id,
      myTitle: r.my_title,
      myHandle: r.my_handle,
      myImageUrl: r.my_image_url,
    })),
    totalCount: raw[0]?.total_count ?? 0,
    outCount: raw[0]?.out_count ?? 0,
  };
}

/**
 * Every rival shop on the page, and the totals before any filter is
 * applied. Kept separate from the row query so the shop dropdown does
 * not shrink to whatever the user already picked.
 */
export async function getStockFacets(userId: string): Promise<{
  shops: string[];
  totalCount: number;
  outCount: number;
}> {
  const result = await db.execute<{
    store_domain: string;
    n: number;
    out_n: number;
  }>(sql`
    WITH candidates AS (${candidatesCte(userId)})
    SELECT
      store_domain,
      COUNT(*)::int AS n,
      SUM(CASE WHEN latest_available = false THEN 1 ELSE 0 END)::int AS out_n
    FROM candidates
    GROUP BY store_domain
    ORDER BY store_domain ASC
  `);
  const rows = Array.from(result);
  return {
    shops: rows.map((r) => r.store_domain),
    totalCount: rows.reduce((n, r) => n + Number(r.n), 0),
    outCount: rows.reduce((n, r) => n + Number(r.out_n), 0),
  };
}

/** Query-string for the export link, filters only. */
export function stockFilterParams(filters: StockFilters): string {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  if (filters.out) sp.set("out", "1");
  if (filters.shop) sp.set("shop", filters.shop);
  return sp.toString();
}
