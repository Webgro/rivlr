import { db, schema, type TagColor } from "@/lib/db";
import { eq, asc, desc, and, ne, gt, sql } from "drizzle-orm";
import { getLatestMultiMarketForProduct } from "@/lib/crawler/multi-market";
import { inferMarketFromDomain } from "@/lib/crawler/shopify";

/**
 * Recent-history window for the product-detail chart. Plenty for the
 * "what's the trend lately" use case without dragging the page-load
 * cost up with thousands of rows on long-running products. Full
 * history is still available via the dedicated endpoint when needed.
 */
const HISTORY_DAYS = 90;

export type ProductDetailData = NonNullable<
  Awaited<ReturnType<typeof getProductData>>
>;

export async function getProductData(userId: string, id: string) {
  const [product] = await db
    .select()
    .from(schema.trackedProducts)
    .where(
      and(
        eq(schema.trackedProducts.id, id),
        eq(schema.trackedProducts.userId, userId),
      ),
    )
    .limit(1);

  if (!product) return null;

  // Linked products query — only fires when product is in a group.
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
  const linkedQuery: Promise<readonly LinkedRow[]> = product.groupId
    ? db
        .execute<LinkedRow>(sql`
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
            AND p.user_id = ${userId}::uuid
            AND p.id != ${id}::uuid
          ORDER BY p.added_at ASC
        `)
        .then((r) => Array.from(r))
    : Promise.resolve([] as LinkedRow[]);

  // All independent fan-out reads — fire in parallel. Previously
  // multiMarket and linkedProducts each blocked the page on their own
  // round trip; folding them into a single Promise.all eliminates 2
  // sequential round trips per page load.
  const [
    priceObs,
    stockObs,
    recent,
    tagMeta,
    multiMarket,
    linkedProducts,
  ] = await Promise.all([
    db
      .select({
        observedAt: schema.priceObservations.observedAt,
        price: schema.priceObservations.price,
        currency: schema.priceObservations.currency,
      })
      .from(schema.priceObservations)
      .where(
        and(
          eq(schema.priceObservations.productId, id),
          gt(
            schema.priceObservations.observedAt,
            sql`NOW() - (${HISTORY_DAYS}::int || ' days')::interval`,
          ),
        ),
      )
      .orderBy(asc(schema.priceObservations.observedAt)),
    db
      .select({
        observedAt: schema.stockObservations.observedAt,
        available: schema.stockObservations.available,
        quantity: schema.stockObservations.quantity,
        quantitySource: schema.stockObservations.quantitySource,
      })
      .from(schema.stockObservations)
      .where(
        and(
          eq(schema.stockObservations.productId, id),
          gt(
            schema.stockObservations.observedAt,
            sql`NOW() - (${HISTORY_DAYS}::int || ' days')::interval`,
          ),
        ),
      )
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
          .where(eq(schema.tags.userId, userId))
      : Promise.resolve([] as Array<{ name: string; color: string }>),
    getLatestMultiMarketForProduct(id),
    linkedQuery,
  ]);

  const tagColors: Record<string, TagColor> = {};
  for (const t of tagMeta) tagColors[t.name] = (t.color as TagColor) ?? "gray";

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
  /** Latest price as numeric string: from price_observations for a tracked
   *  candidate, from the catalogue scan for a discovered one. Null if unknown. */
  price: string | null;
  currency: string;
  /** Latest availability boolean from stock_observations. */
  available: boolean | null;
  /** Where the row came from. A "discovered" candidate isn't tracked yet, so
   *  linking it has to start tracking it first. */
  source: "tracked" | "discovered";
  [key: string]: unknown;
};

/** A candidate as it comes back from SQL. Same shape as LinkCandidate except
 *  currency: discovered_products has no such column, so the query leaves it
 *  NULL and it's filled in from the domain on the way out. */
type CandidateRow = {
  id: string;
  title: string | null;
  store_domain: string;
  image_url: string | null;
  price: string | null;
  currency: string | null;
  available: boolean | null;
  source: "tracked" | "discovered";
};

interface LinkCandidatesOpts {
  limit?: number;
  query?: string;
  /** Filter to a specific store's products. */
  store?: string;
  /** When true, return ALL competitor products (no token-similarity gate)
   *  in newest-first order. Driven by the /my-products modal so the user
   *  can browse and search the full catalogue. */
  browseAll?: boolean;
}

/**
 * Competitor candidates for linking. Three modes:
 *
 *  - browseAll=true (with optional query): full searchable browse of all
 *    candidates (or filtered by store). Used by the /my-products modal so
 *    the user can pick anything, not just fuzzy auto-matches.
 *  - With `query` and no browseAll: substring matches against title,
 *    handle, and store domain — for incremental search.
 *  - No query, no browseAll: fuzzy auto-suggestions based on the
 *    product's own title (longest tokens). Smart default when opening
 *    the link modal from a product detail page.
 *
 * Candidates come from two places: products the user already tracks, and
 * rows still sitting in their discovery queue. The second half matters
 * because a competitor's imported catalogue lands in discovered_products,
 * and until it was included here those products couldn't be linked at all.
 *
 * Always excludes: the user's own store (never a valid competitor),
 * same-group products, the product itself.
 *
 * Includes latest price + stock so the modal can show inline price
 * comparison ("My £30 vs their £25").
 */
export async function getLinkCandidates(
  userId: string,
  productId: string,
  optsOrLimit?: number | LinkCandidatesOpts,
  legacyQuery?: string,
): Promise<LinkCandidate[]> {
  // Backwards-compat: old callers passed (userId, id, limit, query).
  const opts: LinkCandidatesOpts =
    typeof optsOrLimit === "number"
      ? { limit: optsOrLimit, query: legacyQuery }
      : (optsOrLimit ?? {});

  const limit = opts.limit ?? 30;
  const trimmedQuery = opts.query?.trim().toLowerCase() ?? "";

  const [self] = await db
    .select()
    .from(schema.trackedProducts)
    .where(
      and(
        eq(schema.trackedProducts.id, productId),
        eq(schema.trackedProducts.userId, userId),
      ),
    )
    .limit(1);
  if (!self) return [];

  const storeFilter = opts.store
    ? sql`AND c.store_domain = ${opts.store}`
    : sql``;
  const queryFilter =
    trimmedQuery.length > 0
      ? sql`AND (
          LOWER(COALESCE(c.title, '')) LIKE ${"%" + trimmedQuery + "%"}
          OR LOWER(c.handle) LIKE ${"%" + trimmedQuery + "%"}
          OR LOWER(c.store_domain) LIKE ${"%" + trimmedQuery + "%"}
        )`
      : sql``;

  // Own-store exclusion sits inside each branch rather than over the union
  // so the price/stock laterals never run for rows we're about to drop.
  // The flag is per-user in user_store_prefs: stores.is_my_store is a single
  // global row left over from before the multi-tenant cutover, so reading it
  // hid one tenant's store from everybody and nobody's own products from
  // themselves.
  const ownStoreCheck = (domainColumn: string) => sql`
    AND NOT EXISTS (
      SELECT 1 FROM user_store_prefs usp
      WHERE usp.user_id = ${userId}::uuid
        AND usp.domain = ${sql.raw(domainColumn)}
        AND usp.is_my_store = true
    )`;

  const pool = sql`
    SELECT
      p.id, p.title, p.handle, p.store_domain, p.image_url, p.currency,
      lp.price,
      ls.available,
      'tracked'::text AS source,
      p.added_at AS sort_at
    FROM tracked_products p
    LEFT JOIN LATERAL (
      SELECT price FROM price_observations
      WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
    ) lp ON true
    LEFT JOIN LATERAL (
      SELECT available FROM stock_observations
      WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
    ) ls ON true
    WHERE p.id != ${productId}::uuid
      AND p.user_id = ${userId}::uuid
      AND p.active = true
      AND (p.group_id IS NULL OR p.group_id != COALESCE(${self.groupId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid))
      ${ownStoreCheck("p.store_domain")}
    UNION ALL
    SELECT
      d.id, d.title, d.handle, d.store_domain, d.image_url,
      NULL::text AS currency,
      d.price,
      d.available,
      'discovered'::text AS source,
      d.first_seen AS sort_at
    FROM discovered_products d
    WHERE d.user_id = ${userId}::uuid
      AND d.status = 'new'
      ${ownStoreCheck("d.store_domain")}
  `;

  const columns = sql`
    c.id, c.title, c.store_domain, c.image_url, c.currency,
    c.price, c.available, c.source
  `;
  // Already-tracked candidates first: they carry price history, and a user
  // scrolling a competitor's whole catalogue would otherwise never see them.
  const ordering = sql`ORDER BY (c.source = 'tracked') DESC, c.sort_at DESC`;

  // Browse-all OR query mode: straightforward filtered list.
  if (opts.browseAll || trimmedQuery.length > 0) {
    const rows = await db.execute<CandidateRow>(sql`
      WITH pool AS (${pool})
      SELECT ${columns}
      FROM pool c
      WHERE true
        ${storeFilter}
        ${queryFilter}
      ${ordering}
      LIMIT ${limit}
    `);
    return withCurrency(rows);
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
    .map((t) => `LOWER(c.title) LIKE '%${t.replace(/'/g, "''")}%'`)
    .join(" OR ");

  const rows = await db.execute<CandidateRow>(sql`
    WITH pool AS (${pool})
    SELECT ${columns}
    FROM pool c
    WHERE (${sql.raw(orClauses)})
      ${storeFilter}
    ${ordering}
    LIMIT ${limit}
  `);

  return withCurrency(rows);
}

/** Discovered rows have no stored currency, so derive it from the domain the
 *  same way tracking does — otherwise the modal's Δ% would never line up. */
function withCurrency(rows: Iterable<CandidateRow>): LinkCandidate[] {
  return Array.from(rows, (r) => ({
    ...r,
    currency: r.currency ?? inferMarketFromDomain(r.store_domain).currency,
  }));
}
