import { db, schema } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";

/**
 * The Prices page's data layer, shared with /api/prices/export so the
 * spreadsheet and the screen can never drift apart. Both call
 * getPriceRows with the same filters and get the same rows back.
 *
 * "Rival" here means: another product this user watches, in the same
 * match group, on a shop they have NOT marked as their own. Own-shop
 * status comes from user_store_prefs.is_my_store only —
 * stores.is_my_store is a stale global flag and is never read.
 */

export interface PriceFilters {
  /** Free text against the product name. */
  q?: string;
  /** "yes" = has at least one rival, "no" = none matched yet. */
  match?: string;
  /** Only products with a rival on this shop. */
  shop?: string;
}

export interface PriceProduct {
  id: string;
  title: string | null;
  handle: string;
  imageUrl: string | null;
  currency: string;
  isFavourite: boolean;
  tags: string[];
  sku: string | null;
  myVariants: number;
  myPrice: number | null;
  available: boolean | null;
  quantity: number | null;
  rivalShops: string[];
  bestShop: string | null;
  bestCurrency: string | null;
  bestPrice: number | null;
  bestVariants: number | null;
}

type Raw = {
  id: string;
  title: string | null;
  handle: string;
  image_url: string | null;
  currency: string;
  is_favourite: boolean;
  tags: string[] | null;
  sku: string | null;
  my_variants: number;
  latest_price: string | null;
  latest_available: boolean | null;
  latest_quantity: number | null;
  rival_shops: string[] | null;
  best_shop: string | null;
  best_currency: string | null;
  best_price: string | null;
  best_variants: number | null;
};

/** The shop this user has marked as their own, if any. */
export async function getMyShop(userId: string) {
  const [mine] = await db
    .select({
      domain: schema.userStorePrefs.domain,
      displayName: schema.stores.displayName,
    })
    .from(schema.userStorePrefs)
    .leftJoin(
      schema.stores,
      eq(schema.stores.domain, schema.userStorePrefs.domain),
    )
    .where(
      and(
        eq(schema.userStorePrefs.userId, userId),
        eq(schema.userStorePrefs.isMyStore, true),
      ),
    )
    .limit(1);
  return mine ?? null;
}

export async function getPriceRows(
  userId: string,
  domain: string,
  filters: PriceFilters = {},
): Promise<{
  /** Rows after filtering — what the user sees, and what exports. */
  rows: PriceProduct[];
  /** Total before filtering, for the "showing X of Y" line. */
  totalCount: number;
  /** Every shop a rival sits on, for the shop dropdown. Unfiltered so
   *  the dropdown does not shrink to whatever is already picked. */
  rivalShopOptions: string[];
  /** How many products have at least one rival, before filtering. */
  withRivalCount: number;
}> {
  const result = await db.execute<Raw>(sql`
    WITH rivals AS (
      SELECT
        c.group_id, c.store_domain, c.currency, c.latest_price,
        COALESCE(array_length(c.skus, 1), 1) AS variants
      FROM tracked_products c
      LEFT JOIN user_store_prefs own
        ON own.user_id = ${userId}::uuid
       AND own.domain = c.store_domain
       AND own.is_my_store = true
      WHERE c.user_id = ${userId}::uuid
        AND c.active = true
        AND c.group_id IS NOT NULL
        AND own.domain IS NULL
    )
    SELECT
      p.id, p.title, p.handle, p.image_url, p.currency, p.is_favourite, p.tags,
      p.skus[1] AS sku,
      COALESCE(array_length(p.skus, 1), 1) AS my_variants,
      p.latest_price::text AS latest_price,
      p.latest_available,
      p.latest_quantity,
      rs.shops AS rival_shops,
      bc.store_domain AS best_shop,
      bc.currency AS best_currency,
      bc.latest_price::text AS best_price,
      bc.variants::int AS best_variants
    FROM tracked_products p
    -- Every rival shop for this product, used by the shop filter and the
    -- row's "2 rivals" line.
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(rv.store_domain ORDER BY rv.store_domain) AS shops
      FROM rivals rv
      WHERE rv.group_id = p.group_id
    ) rs ON p.group_id IS NOT NULL
    -- Cheapest rival by CURRENT price, not by whoever was checked last.
    LEFT JOIN LATERAL (
      SELECT rv.store_domain, rv.currency, rv.latest_price, rv.variants
      FROM rivals rv
      WHERE rv.group_id = p.group_id
        AND rv.latest_price IS NOT NULL
      ORDER BY rv.latest_price ASC
      LIMIT 1
    ) bc ON p.group_id IS NOT NULL
    WHERE p.user_id = ${userId}::uuid
      AND p.store_domain = ${domain}
      AND p.active = true
    ORDER BY p.is_favourite DESC, p.added_at DESC
  `);

  const all: PriceProduct[] = Array.from(result).map((r) => ({
    id: r.id,
    title: r.title,
    handle: r.handle,
    imageUrl: r.image_url,
    currency: r.currency,
    isFavourite: r.is_favourite,
    tags: r.tags ?? [],
    sku: r.sku,
    myVariants: Number(r.my_variants) || 1,
    myPrice: r.latest_price !== null ? Number(r.latest_price) : null,
    available: r.latest_available,
    quantity: r.latest_quantity,
    rivalShops: r.rival_shops ?? [],
    bestShop: r.best_shop,
    bestCurrency: r.best_currency,
    bestPrice: r.best_price !== null ? Number(r.best_price) : null,
    bestVariants: r.best_variants !== null ? Number(r.best_variants) : null,
  }));

  const rivalShopOptions = Array.from(
    new Set(all.flatMap((r) => r.rivalShops)),
  ).sort();
  const withRivalCount = all.filter((r) => r.rivalShops.length > 0).length;

  let rows = all;
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) =>
        (r.title ?? "").toLowerCase().includes(q) ||
        r.handle.toLowerCase().includes(q),
    );
  }
  if (filters.match === "yes") {
    rows = rows.filter((r) => r.rivalShops.length > 0);
  } else if (filters.match === "no") {
    rows = rows.filter((r) => r.rivalShops.length === 0);
  }
  if (filters.shop) {
    rows = rows.filter((r) => r.rivalShops.includes(filters.shop!));
  }

  return {
    rows,
    totalCount: all.length,
    rivalShopOptions,
    withRivalCount,
  };
}

/** Query-string for the export link / the filter form, filters only. */
export function priceFilterParams(filters: PriceFilters): string {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  if (filters.match) sp.set("match", filters.match);
  if (filters.shop) sp.set("shop", filters.shop);
  return sp.toString();
}
