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

export async function generateLinkSuggestions() {
  const products = await db
    .select({
      id: schema.trackedProducts.id,
      title: schema.trackedProducts.title,
      handle: schema.trackedProducts.handle,
      storeDomain: schema.trackedProducts.storeDomain,
      groupId: schema.trackedProducts.groupId,
    })
    .from(schema.trackedProducts);

  if (products.length < 2) return { suggested: 0 };

  // Existing pending suggestions to avoid duplicates.
  const existing = await db
    .select({
      a: schema.linkSuggestions.productAId,
      b: schema.linkSuggestions.productBId,
    })
    .from(schema.linkSuggestions);
  const existingPairs = new Set(
    existing.map(({ a, b }) => pairKey(a, b)),
  );

  const tokens = products.map((p) => ({
    ...p,
    tokens: tokenise(p.title ?? p.handle),
  }));

  const suggestions: Array<{ a: string; b: string; score: number }> = [];

  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const a = tokens[i];
      const b = tokens[j];
      // Skip same store — variants on a single store aren't "linkable" in
      // this sense (and Shopify already groups them as variants).
      if (a.storeDomain === b.storeDomain) continue;
      // Skip if already linked into the same group.
      if (a.groupId && a.groupId === b.groupId) continue;

      const score = jaccard(a.tokens, b.tokens);
      if (score >= SCORE_THRESHOLD) {
        const key = pairKey(a.id, b.id);
        if (existingPairs.has(key)) continue;
        suggestions.push({ a: a.id, b: b.id, score });
      }
    }
  }

  // Highest-scoring first; cap to MAX so we don't flood the suggestions UI.
  suggestions.sort((x, y) => y.score - x.score);
  const top = suggestions.slice(0, MAX_SUGGESTIONS);

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
