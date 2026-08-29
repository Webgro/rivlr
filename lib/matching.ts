import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Matching a competitor's catalogue against the user's own products.
 *
 * Why this exists: adding products one URL at a time is slow, and a new
 * user has no idea where to start. Once we know a competitor's whole
 * catalogue (one cheap paginated request per 250 products) we can tell
 * the user which of their own products that competitor also sells, and
 * let them track those in one click with the link already made.
 *
 * Match keys, strongest first:
 *   1. SKU overlap.
 *   2. Barcode (EAN/UPC) overlap.
 *   3. Trigram title similarity.
 *
 * A note on (1), because the obvious assumption is wrong: retailers do
 * NOT generally carry the manufacturer's SKU. Measured across two real
 * Irish retailers with 99% SKU coverage on both sides, shared SKUs came
 * to exactly zero — petworld.ie uses codes like `MM1025NET` while
 * homeland.ie uses department-prefixed ones like `43.HZ2293P9000`. SKU
 * is kept because it is free to compute and definitive when it does
 * fire (dropshippers and same-distributor stores), but title carries
 * the feature in practice.
 *
 * Which forces fuzziness, and fuzziness is dangerous here: a wrong link
 * silently corrupts every price comparison downstream. Raw trigram
 * similarity cannot tell product variants apart, because colour and
 * size differ by only a few characters. Real false positives it
 * produced on live data:
 *
 *   0.81  "Ancol Extra Heavy Chain Lead Black 20"" ~ "... Black 80""
 *   0.72  "Ancol Chain Lead Black 30" Heavy"       ~ "... Lead Tan 30""
 *
 * So every fuzzy candidate goes through `discriminatorsAgree`: if both
 * titles state a size/quantity and none of them match, or both state a
 * colour and none match, the pair is rejected outright regardless of
 * how similar the strings look. Stated-on-one-side-only is allowed
 * through, since that is missing information rather than a conflict.
 */

export type MatchMethod = "sku" | "barcode" | "title";
/** How much to trust the pair. Drives whether the UI pre-ticks it. */
export type MatchConfidence = "exact" | "high" | "likely";

/** Below this, titles are too different to be worth showing at all. */
const TITLE_SIMILARITY_FLOOR = 0.62;
/** At or above this, a title match is treated as high confidence. */
const TITLE_SIMILARITY_HIGH = 0.85;
/** Candidates to consider per competitor product before guarding. */
const CANDIDATES_PER_PRODUCT = 3;

const COLOUR_WORDS = new Set([
  "black", "white", "red", "blue", "green", "yellow", "pink", "purple",
  "grey", "gray", "brown", "tan", "navy", "orange", "silver", "gold",
  "beige", "cream", "teal", "lilac", "charcoal", "burgundy", "maroon",
  "turquoise", "olive", "khaki", "ivory", "bronze", "copper", "rose",
]);

/**
 * Units normalised to a base so "1kg" and "1000g" compare equal.
 * Anything not listed keeps its own unit, and bare numbers get the
 * empty unit — a bare 20 and a bare 80 still conflict, which is the
 * case that catches lead lengths and pack counts.
 */
const UNIT_SCALE: Record<string, [number, string]> = {
  kg: [1000, "g"], g: [1, "g"],
  l: [1000, "ml"], ml: [1, "ml"], cl: [10, "ml"],
  m: [100, "cm"], cm: [1, "cm"], mm: [0.1, "cm"],
  in: [1, "in"], inch: [1, "in"], inches: [1, "in"], '"': [1, "in"],
  ft: [12, "in"],
  pk: [1, "pk"], pack: [1, "pk"], pcs: [1, "pk"], pc: [1, "pk"],
};

const NUMBER_RE =
  /(\d+(?:\.\d+)?)\s*(kg|g|ml|cl|l|mm|cm|m|inches|inch|in|ft|pcs|pc|pk|pack|")?/g;

/** Size/quantity tokens stated in a title, normalised to base units. */
function sizeTokens(title: string): Set<string> {
  const out = new Set<string>();
  for (const m of title.toLowerCase().matchAll(NUMBER_RE)) {
    const value = Number(m[1]);
    if (!Number.isFinite(value)) continue;
    const rawUnit = m[2] ?? "";
    const scale = UNIT_SCALE[rawUnit];
    if (scale) {
      out.add(`${value * scale[0]}${scale[1]}`);
    } else {
      out.add(String(value));
    }
  }
  return out;
}

function colourTokens(title: string): Set<string> {
  const out = new Set<string>();
  for (const w of title.toLowerCase().split(/[^a-z]+/)) {
    if (COLOUR_WORDS.has(w)) out.add(w === "gray" ? "grey" : w);
  }
  return out;
}

function disjoint(a: Set<string>, b: Set<string>): boolean {
  for (const v of a) if (b.has(v)) return false;
  return true;
}

/**
 * True when nothing in the two titles positively contradicts the other.
 *
 * Only a two-sided conflict rejects. If one title says "250g" and the
 * other says nothing about weight, that is a shorter title, not a
 * different product.
 */
export function discriminatorsAgree(a: string, b: string): boolean {
  const sizeA = sizeTokens(a);
  const sizeB = sizeTokens(b);
  if (sizeA.size > 0 && sizeB.size > 0 && disjoint(sizeA, sizeB)) return false;

  const colourA = colourTokens(a);
  const colourB = colourTokens(b);
  if (colourA.size > 0 && colourB.size > 0 && disjoint(colourA, colourB)) {
    return false;
  }
  return true;
}

export interface CatalogueMatch {
  /** The competitor's product, staged in discovered_products. */
  discoveredId: string;
  theirTitle: string | null;
  theirHandle: string;
  theirImageUrl: string | null;
  theirUrl: string;
  theirPrice: number | null;
  theirAvailable: boolean | null;
  /** The user's own product it matched. */
  myProductId: string;
  myTitle: string | null;
  myHandle: string;
  myPrice: number | null;
  myImageUrl: string | null;
  currency: string;
  method: MatchMethod;
  confidence: MatchConfidence;
  /** Their price minus yours. Negative means they undercut you. */
  priceGap: number | null;
}

type Row = {
  discovered_id: string;
  their_title: string | null;
  their_handle: string;
  their_image_url: string | null;
  their_url: string;
  their_price: string | null;
  their_available: boolean | null;
  my_product_id: string;
  my_title: string | null;
  my_handle: string;
  my_price: string | null;
  my_image_url: string | null;
  currency: string;
  method: MatchMethod;
  sim: string | null;
  [key: string]: unknown;
};

/**
 * Same normalisation both sides: lower-case, strip everything that is
 * not a letter, digit or space, collapse whitespace. Kept as one
 * constant because the expression index must match it character for
 * character to be used.
 */
const NORM_TITLE = (col: string) => sql.raw(`
  regexp_replace(
    regexp_replace(lower(coalesce(${col}, '')), '[^a-z0-9 ]', '', 'g'),
    '\\s+', ' ', 'g'
  )
`);

/**
 * Find products a competitor sells that the user also sells.
 *
 * Ordered by how badly the user is being undercut, so the most useful
 * rows are first and a `limit` of 5 returns the five that matter most,
 * not five arbitrary ones.
 */
export async function findCatalogueMatches(opts: {
  userId: string;
  competitorDomain: string;
  limit?: number;
}): Promise<CatalogueMatch[]> {
  const { userId, competitorDomain, limit = 50 } = opts;

  // Wrapped in a transaction purely to pin `SET LOCAL` and the query to
  // the same connection. The `%` operator below reads its threshold
  // from that GUC and is the only form pg_trgm can answer from the GIN
  // index — the equivalent `similarity(a, b) >= x` predicate is not
  // indexable and measured 39s against 455s on the same 3k x 1k pair.
  const rows = await db.transaction(async (tx) => {
    await tx.execute(
      sql`SET LOCAL pg_trgm.similarity_threshold = ${sql.raw(String(TITLE_SIMILARITY_FLOOR))}`,
    );
    return tx.execute<Row>(sql`
    WITH mine AS NOT MATERIALIZED (
      SELECT p.id, p.title, p.handle, p.image_url, p.currency,
             p.skus, p.barcodes, p.latest_price,
             ${NORM_TITLE("p.title")} AS norm_title
      FROM tracked_products p
      JOIN user_store_prefs usp
        ON usp.user_id = p.user_id
       AND usp.domain = p.store_domain
       AND usp.is_my_store = true
      WHERE p.user_id = ${userId}::uuid
        AND p.active = true
    ),
    theirs AS NOT MATERIALIZED (
      SELECT d.id, d.title, d.handle, d.image_url, d.url,
             d.skus, d.price, d.available,
             ${NORM_TITLE("d.title")} AS norm_title
      FROM discovered_products d
      WHERE d.user_id = ${userId}::uuid
        AND d.store_domain = ${competitorDomain}
        AND d.status = 'new'
    ),
    paired AS (
      SELECT t.id AS discovered_id, m.id AS my_product_id,
             'sku'::text AS method, 1 AS rank, 1.0::real AS sim
      FROM theirs t JOIN mine m ON m.skus && t.skus
      UNION ALL
      SELECT t.id, m.id, 'barcode', 2, 1.0::real
      FROM theirs t JOIN mine m ON m.barcodes && t.skus
      UNION ALL
      SELECT t.id, m.id, 'title', 3, similarity(m.norm_title, t.norm_title)
      FROM theirs t JOIN mine m
        ON m.norm_title % t.norm_title
       AND length(t.norm_title) > 8
    ),
    ranked AS (
      -- Keep the few strongest candidates per competitor product, not
      -- just the single best: the best one may fail the guard, and a
      -- runner-up on a different colourway is often the right link.
      SELECT discovered_id, my_product_id, method, sim,
             ROW_NUMBER() OVER (
               PARTITION BY discovered_id ORDER BY rank, sim DESC
             ) AS n
      FROM paired
    )
    SELECT
      r.discovered_id, r.my_product_id, r.method, r.sim::text AS sim,
      t.title AS their_title, t.handle AS their_handle,
      t.image_url AS their_image_url, t.url AS their_url,
      t.price::text AS their_price, t.available AS their_available,
      m.title AS my_title, m.handle AS my_handle,
      m.image_url AS my_image_url,
      m.latest_price::text AS my_price,
      m.currency
    FROM ranked r
    JOIN theirs t ON t.id = r.discovered_id
    JOIN mine m ON m.id = r.my_product_id
    WHERE r.n <= ${CANDIDATES_PER_PRODUCT}
    -- Biggest undercut first. Products with no price on either side
    -- sort last rather than being dropped: the user may still want them.
    ORDER BY
      CASE WHEN t.price IS NULL OR m.latest_price IS NULL THEN 1 ELSE 0 END,
      (t.price - m.latest_price) ASC,
      r.n ASC
  `);
  });

  const out: CatalogueMatch[] = [];
  const taken = new Set<string>();

  // Every survivor is collected before `limit` is applied: the rows
  // arrive in price-gap order, so slicing here would pick the loudest
  // rather than the most trustworthy, which the sort below decides.
  for (const r of rows) {
    // One row per competitor product. Rows arrive best-candidate-first
    // within each product, so the first survivor is the strongest.
    if (taken.has(r.discovered_id)) continue;

    const sim = r.sim !== null ? Number(r.sim) : 0;

    if (r.method === "title") {
      if (!discriminatorsAgree(r.my_title ?? "", r.their_title ?? "")) {
        continue;
      }
    }

    taken.add(r.discovered_id);

    const theirPrice = r.their_price !== null ? Number(r.their_price) : null;
    const myPrice = r.my_price !== null ? Number(r.my_price) : null;
    const confidence: MatchConfidence =
      r.method !== "title"
        ? "exact"
        : sim >= TITLE_SIMILARITY_HIGH
          ? "high"
          : "likely";

    out.push({
      discoveredId: r.discovered_id,
      theirTitle: r.their_title,
      theirHandle: r.their_handle,
      theirImageUrl: r.their_image_url,
      theirUrl: r.their_url,
      theirPrice,
      theirAvailable: r.their_available,
      myProductId: r.my_product_id,
      myTitle: r.my_title,
      myHandle: r.my_handle,
      myPrice,
      myImageUrl: r.my_image_url,
      currency: r.currency,
      method: r.method,
      confidence,
      priceGap:
        theirPrice !== null && myPrice !== null
          ? Number((theirPrice - myPrice).toFixed(2))
          : null,
    });
  }

  // Confidence outranks price gap. The SQL already ordered by undercut,
  // which is the right tie-break, but a headline "32% cheaper" that
  // turns out to be a different colourway is worse than no row at all —
  // so the rows we are surest of go first, and a caller taking the top
  // 5 (onboarding) gets the 5 most trustworthy, not the 5 loudest.
  const tier: Record<MatchConfidence, number> = { exact: 0, high: 1, likely: 2 };
  // Stable sort, so within a tier the SQL's biggest-undercut-first order
  // survives untouched.
  out.sort((a, b) => tier[a.confidence] - tier[b.confidence]);
  return out.slice(0, limit);
}

/** How many matches exist, without pulling the rows. */
export async function countCatalogueMatches(opts: {
  userId: string;
  competitorDomain: string;
}): Promise<number> {
  const matches = await findCatalogueMatches({ ...opts, limit: 5000 });
  return matches.length;
}
