import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Looks for tracked products that are likely the same item across stores
 * (different store_domain, similar title) and proposes them as link
 * suggestions. The user reviews these on /products/suggestions.
 *
 * Strategy: trigram similarity on title. Postgres has pg_trgm built in via
 * the similarity() function — but enabling the extension may require
 * superuser perms which Neon allows. If the extension isn't available we
 * fall back to a token-overlap heuristic.
 *
 * For v1 we use a simple JS-side token-overlap heuristic that doesn't need
 * any extensions: tokenise titles, count shared tokens, score by Jaccard.
 * Cheap at v1 scale (few thousand products).
 */

const MIN_TOKEN_LEN = 4;
const SCORE_THRESHOLD = 0.45;
const MAX_SUGGESTIONS = 200;

function tokenise(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= MIN_TOKEN_LEN),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect += 1;
  return intersect / (a.size + b.size - intersect);
}

/** Score given to GTIN-matched suggestion pairs. 1.0 because GTIN is a hard
 *  global identifier; if both stores publish the same GTIN it's almost
 *  certainly the same product. */
const SCORE_GTIN = 1.0;
/** MPN is manufacturer-set so slightly lower confidence (occasional
 *  collisions across different SKUs that share a part). */
const SCORE_MPN = 0.95;

export async function generateLinkSuggestions() {
  const products = await db
    .select({
      id: schema.trackedProducts.id,
      title: schema.trackedProducts.title,
      handle: schema.trackedProducts.handle,
      storeDomain: schema.trackedProducts.storeDomain,
      groupId: schema.trackedProducts.groupId,
      gtin: schema.trackedProducts.gtin,
      mpn: schema.trackedProducts.mpn,
    })
    .from(schema.trackedProducts);

  if (products.length < 2) return { suggested: 0 };

  // Existing pending / accepted / dismissed suggestions to avoid dupes.
  const existing = await db
    .select({
      a: schema.linkSuggestions.productAId,
      b: schema.linkSuggestions.productBId,
    })
    .from(schema.linkSuggestions);
  const existingPairs = new Set(
    existing.map(({ a, b }) => pairKey(a, b)),
  );

  const suggestions = new Map<string, { a: string; b: string; score: number }>();

  function add(a: string, b: string, score: number) {
    const key = pairKey(a, b);
    if (existingPairs.has(key)) return;
    const prev = suggestions.get(key);
    // Keep the highest-scoring reason for this pair (a single pair can match
    // by both GTIN AND title — GTIN wins).
    if (!prev || score > prev.score) {
      suggestions.set(key, { a, b, score });
    }
  }

  // ─── 1. GTIN matches (hard identifier — score 1.0) ───────────────────
  const byGtin = new Map<string, typeof products>();
  for (const p of products) {
    if (!p.gtin || !/^\d{8,14}$/.test(p.gtin)) continue;
    const list = byGtin.get(p.gtin) ?? [];
    list.push(p);
    byGtin.set(p.gtin, list);
  }
  for (const list of byGtin.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.storeDomain === b.storeDomain) continue;
        if (a.groupId && a.groupId === b.groupId) continue;
        add(a.id, b.id, SCORE_GTIN);
      }
    }
  }

  // ─── 2. MPN matches (manufacturer part — score 0.95) ─────────────────
  const byMpn = new Map<string, typeof products>();
  for (const p of products) {
    if (!p.mpn) continue;
    const norm = p.mpn.trim().toUpperCase();
    if (norm.length < 4) continue; // single-digit MPNs collide too often
    const list = byMpn.get(norm) ?? [];
    list.push(p);
    byMpn.set(norm, list);
  }
  for (const list of byMpn.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.storeDomain === b.storeDomain) continue;
        if (a.groupId && a.groupId === b.groupId) continue;
        add(a.id, b.id, SCORE_MPN);
      }
    }
  }

  // ─── 3. Fuzzy title similarity (existing behaviour, score 0.45–1.0) ──
  const tokens = products.map((p) => ({
    ...p,
    tokens: tokenise(p.title ?? p.handle),
  }));
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i];
      const b = tokens[j];
      if (a.storeDomain === b.storeDomain) continue;
      if (a.groupId && a.groupId === b.groupId) continue;

      const score = jaccard(a.tokens, b.tokens);
      if (score >= SCORE_THRESHOLD) {
        add(a.id, b.id, score);
      }
    }
  }

  const top = Array.from(suggestions.values())
    .sort((x, y) => y.score - x.score)
    .slice(0, MAX_SUGGESTIONS);

  if (top.length === 0) return { suggested: 0 };

  await db
    .insert(schema.linkSuggestions)
    .values(
      top.map((s) => ({
        productAId: s.a,
        productBId: s.b,
        score: s.score.toFixed(3),
        status: "pending" as const,
      })),
    )
    .onConflictDoNothing();

  return { suggested: top.length };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
