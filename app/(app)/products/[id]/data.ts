import { db, schema, type TagColor } from "@/lib/db";
import { eq, asc, desc, and, ne, sql } from "drizzle-orm";
import { getLatestMultiMarketForProduct } from "@/lib/crawler/multi-market";

export type ProductDetailData = NonNullable<
  Awaited<ReturnType<typeof getProductData>>
>;

export async function getProductData(id: string) {
  const [product] = await db
    .select()
    .from(schema.trackedProducts)
    .where(eq(schema.trackedProducts.id, id))
    .limit(1);

  if (!product) return null;

  const multiMarket = await getLatestMultiMarketForProduct(id);

  const [priceObs, stockObs, recent, tagMeta] = await Promise.all([
    db
      .select({
        observedAt: schema.priceObservations.observedAt,
        price: schema.priceObservations.price,
        currency: schema.priceObservations.currency,
      })
      .from(schema.priceObservations)
      .where(eq(schema.priceObservations.productId, id))
      .orderBy(asc(schema.priceObservations.observedAt)),
    db
      .select({
        observedAt: schema.stockObservations.observedAt,
        available: schema.stockObservations.available,
        quantity: schema.stockObservations.quantity,
        quantitySource: schema.stockObservations.quantitySource,
      })
      .from(schema.stockObservations)
      .where(eq(schema.stockObservations.productId, id))
      .orderBy(asc(schema.stockObservations.observedAt)),
    db
      .select({
        observedAt: schema.priceObservations.observedAt,
        price: schema.priceObservations.price,
      })
      .from(schema.priceObservations)
      .where(eq(schema.priceObservations.productId, id))
      .orderBy(desc(schema.priceObservations.observedAt))
      .limit(20),
    product.tags.length > 0
      ? db
          .select({ name: schema.tags.name, color: schema.tags.color })
          .from(schema.tags)
      : Promise.resolve([] as Array<{ name: string; color: string }>),
  ]);

  const tagColors: Record<string, TagColor> = {};
  for (const t of tagMeta) tagColors[t.name] = (t.color as TagColor) ?? "gray";

  // Linked products (same group_id, excluding this one) with current price/stock.
  type LinkedRow = {
    id: string;
    title: string | null;
    handle: string;
    store_domain: string;
    image_url: string | null;
    currency: string;
    price: string | null;
    available: boolean | null;
    quantity: number | null;
  };

  let linkedProducts: LinkedRow[] = [];
  if (product.groupId) {
    const linked = await db.execute<LinkedRow>(sql`
      SELECT
        p.id, p.title, p.handle, p.store_domain, p.image_url, p.currency,
        lp.price, ls.available, ls.quantity
      FROM tracked_products p
      LEFT JOIN LATERAL (
        SELECT price FROM price_observations
        WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
      ) lp ON true
      LEFT JOIN LATERAL (
        SELECT available, quantity FROM stock_observations
        WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
      ) ls ON true
      WHERE p.group_id = ${product.groupId}::uuid
        AND p.id != ${id}::uuid
      ORDER BY p.added_at ASC
    `);
    linkedProducts = Array.from(linked);
  }

  return {
    product,
    priceObs,
    stockObs,
    recent,
    tagColors,
    linkedProducts,
    multiMarket,
  };
}

export type LinkCandidate = {
  id: string;
  title: string | null;
  store_domain: string;
  image_url: string | null;
  /** Latest price as numeric string from price_observations, or null. */
  price: string | null;
  currency: string;
  /** Latest availability boolean from stock_observations. */
  available: boolean | null;
  /** True when this candidate's store_domain has is_my_store = true. */
  is_my_store: boolean;
  [key: string]: unknown;
};

interface LinkCandidatesOpts {
  limit?: number;
  query?: string;
  /** Filter to a specific store's products. */
  store?: string;
  /** When true, exclude products on stores marked as the user's own.
   *  Use from /my-products: linking-to-self isn't useful. */
  excludeOwnStore?: boolean;
  /** When true, return ALL competitor products (no token-similarity gate)
   *  in newest-first order. Driven by the /my-products modal so the user
   *  can browse and search the full catalogue. */
  browseAll?: boolean;
}

/**
 * Candidates for linking. Three modes:
 *
 *  - browseAll=true (with optional query): full searchable browse of all
 *    products (or filtered by store). Used by the /my-products modal so
 *    the user can pick anything, not just fuzzy auto-matches.
 *  - With `query` and no browseAll: substring matches against title,
 *    handle, and store domain — for incremental search.
 *  - No query, no browseAll: fuzzy auto-suggestions based on the
 *    product's own title (longest tokens). Smart default when opening
 *    the link modal from a product detail page.
 *
 * Always excludes: same-group products, the product itself.
 * Optionally excludes: own-store products, products from other stores.
 *
 * Includes latest price + stock so the modal can show inline price
 * comparison ("My £30 vs their £25").
 */
export async function getLinkCandidates(
  productId: string,
  optsOrLimit?: number | LinkCandidatesOpts,
  legacyQuery?: string,
): Promise<LinkCandidate[]> {
  // Backwards-compat: old callers passed (id, limit, query).
  const opts: LinkCandidatesOpts =
    typeof optsOrLimit === "number"
      ? { limit: optsOrLimit, query: legacyQuery }
      : (optsOrLimit ?? {});

  const limit = opts.limit ?? 30;
  const trimmedQuery = opts.query?.trim().toLowerCase() ?? "";

  const [self] = await db
    .select()
    .from(schema.trackedProducts)
    .where(eq(schema.trackedProducts.id, productId))
    .limit(1);
  if (!self) return [];

  const ownStoreFilter = opts.excludeOwnStore
    ? sql`AND COALESCE(st.is_my_store, false) = false`
    : sql``;
  const storeFilter = opts.store
    ? sql`AND p.store_domain = ${opts.store}`
    : sql``;
  const queryFilter =
    trimmedQuery.length > 0
      ? sql`AND (
          LOWER(COALESCE(p.title, '')) LIKE ${"%" + trimmedQuery + "%"}
          OR LOWER(p.handle) LIKE ${"%" + trimmedQuery + "%"}
          OR LOWER(p.store_domain) LIKE ${"%" + trimmedQuery + "%"}
        )`
      : sql``;

  // Browse-all OR query mode: straightforward filtered list, newest first.
  if (opts.browseAll || trimmedQuery.length > 0) {
    const candidates = await db.execute<LinkCandidate>(sql`
      SELECT
        p.id, p.title, p.store_domain, p.image_url, p.currency,
        lp.price,
        ls.available,
        COALESCE(st.is_my_store, false) AS is_my_store
      FROM tracked_products p
      LEFT JOIN stores st ON st.domain = p.store_domain
      LEFT JOIN LATERAL (
        SELECT price FROM price_observations
        WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
      ) lp ON true
      LEFT JOIN LATERAL (
        SELECT available FROM stock_observations
        WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
      ) ls ON true
      WHERE p.id != ${productId}::uuid
        AND p.active = true
        AND (p.group_id IS NULL OR p.group_id != COALESCE(${self.groupId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid))
        ${ownStoreFilter}
        ${storeFilter}
        ${queryFilter}
      ORDER BY p.added_at DESC
      LIMIT ${limit}
    `);
    return Array.from(candidates);
  }

  // Auto-suggest mode — fuzzy match on the product's own longest tokens.
  const title = (self.title ?? self.handle).toLowerCase();
  const tokens = title
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);

  if (tokens.length === 0) return [];

  const orClauses = tokens
    .map((t) => `LOWER(p.title) LIKE '%${t.replace(/'/g, "''")}%'`)
    .join(" OR ");

  const candidates = await db.execute<LinkCandidate>(sql`
    SELECT
      p.id, p.title, p.store_domain, p.image_url, p.currency,
      lp.price,
      ls.available,
      COALESCE(st.is_my_store, false) AS is_my_store
    FROM tracked_products p
    LEFT JOIN stores st ON st.domain = p.store_domain
    LEFT JOIN LATERAL (
      SELECT price FROM price_observations
      WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
    ) lp ON true
    LEFT JOIN LATERAL (
      SELECT available FROM stock_observations
      WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
    ) ls ON true
    WHERE p.id != ${productId}::uuid
      AND p.active = true
      AND (p.group_id IS NULL OR p.group_id != COALESCE(${self.groupId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid))
      ${ownStoreFilter}
      AND (${sql.raw(orClauses)})
    LIMIT ${limit}
  `);

  return Array.from(candidates);
}
