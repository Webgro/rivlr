import { db, schema, type TagColor } from "@/lib/db";
import { eq, asc, desc, and, ne, sql } from "drizzle-orm";

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
  };
}

/**
 * Fuzzy-search candidates for linking — same word in the title is a strong
 * signal. Returns up to N other tracked products that don't already share
 * a group with this one.
 */
export async function getLinkCandidates(productId: string, limit = 20) {
  const [self] = await db
    .select()
    .from(schema.trackedProducts)
    .where(eq(schema.trackedProducts.id, productId))
    .limit(1);
  if (!self) return [];

  // Use the longest word from the title as a search signal.
  const title = (self.title ?? self.handle).toLowerCase();
  const tokens = title
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);

  if (tokens.length === 0) return [];

  // ILIKE any of the tokens — already-linked products are excluded server-side.
  const orClauses = tokens.map((t) => `LOWER(p.title) LIKE '%${t.replace(/'/g, "''")}%'`).join(" OR ");

  const candidates = await db.execute<{
    id: string;
    title: string | null;
    store_domain: string;
    image_url: string | null;
  }>(sql`
    SELECT id, title, store_domain, image_url
    FROM tracked_products p
    WHERE p.id != ${productId}::uuid
      AND (p.group_id IS NULL OR p.group_id != COALESCE(${self.groupId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid))
      AND (${sql.raw(orClauses)})
    LIMIT ${limit}
  `);

  return Array.from(candidates);
}
