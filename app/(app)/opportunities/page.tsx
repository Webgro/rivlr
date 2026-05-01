import Link from "next/link";
import { db, schema } from "@/lib/db";
import { sql, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Opportunities — products on the user's own store that are
 *   (a) likely high-volume (bestseller flag, demand tags, review count,
 *       stockout history), AND
 *   (b) priced higher than at least one tracked competitor.
 *
 * Built from the public-endpoint signal we already collect. Real margin
 * analysis (cost-of-goods aware) is the OAuth/Partner-app phase 2 ask.
 *
 * Importance score (per product):
 *   +3  is_bestseller (in store's "best-sellers" / "featured" collection)
 *   +2  shopify_tags include any of bestseller / featured / top-seller
 *   +2  review_count in top quartile of own store's products
 *   +2  stockout count >= 5 (proxy for repeat demand churn)
 *   +1  reviewCount >= 50 absolute floor
 *
 * Ranking: importance DESC, then price-disadvantage % DESC.
 */

type Row = {
  id: string;
  title: string | null;
  handle: string;
  store_domain: string;
  image_url: string | null;
  currency: string;
  is_bestseller: boolean;
  shopify_tags: string[];
  review_count: number | null;
  stockout_count: number;
  my_price: string | null;
  best_competitor_price: string | null;
  best_competitor_id: string | null;
  best_competitor_title: string | null;
  best_competitor_store: string | null;
  best_competitor_currency: string | null;
};

const DEMAND_TAGS = ["bestseller", "best-seller", "featured", "top-seller", "best seller"];

export default async function OpportunitiesPage() {
  // Find the user's store. If none flagged, render an onboarding state.
  const [mine] = await db
    .select()
    .from(schema.stores)
    .where(eq(schema.stores.isMyStore, true))
    .limit(1);

  if (!mine) return <NoStoreFlagged />;

  // Massive query — for each tracked product on the user's store, find its
  // current price, its stockout count, and the cheapest linked competitor's
  // current price + identity. Filter to products where
  // my_price > best_competitor_price (the actual disadvantage).
  const result = await db.execute<Row>(sql`
    WITH my AS (
      SELECT
        p.id, p.title, p.handle, p.store_domain, p.image_url, p.currency,
        p.is_bestseller, p.shopify_tags, p.review_count, p.group_id,
        (
          SELECT price FROM price_observations
          WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
        ) AS my_price,
        (
          SELECT COUNT(*)::int FROM stock_observations
          WHERE product_id = p.id AND available = false
        ) AS stockout_count
      FROM tracked_products p
      WHERE p.store_domain = ${mine.domain}
        AND p.active = true
    ),
    best_competitor AS (
      SELECT
        my.id AS my_id,
        c.id, c.title, c.store_domain, c.currency,
        cp.price
      FROM my
      JOIN tracked_products c
        ON c.group_id = my.group_id
       AND c.id != my.id
       AND c.store_domain != my.store_domain
       AND c.active = true
      JOIN LATERAL (
        SELECT price FROM price_observations
        WHERE product_id = c.id ORDER BY observed_at DESC LIMIT 1
      ) cp ON true
      WHERE my.group_id IS NOT NULL
    )
    SELECT
      m.id, m.title, m.handle, m.store_domain, m.image_url, m.currency,
      m.is_bestseller, m.shopify_tags, m.review_count, m.stockout_count,
      m.my_price,
      bc.price AS best_competitor_price,
      bc.id    AS best_competitor_id,
      bc.title AS best_competitor_title,
      bc.store_domain AS best_competitor_store,
      bc.currency AS best_competitor_currency
    FROM my m
    LEFT JOIN LATERAL (
      SELECT * FROM best_competitor
      WHERE my_id = m.id
      ORDER BY price ASC
      LIMIT 1
    ) bc ON true
    WHERE m.my_price IS NOT NULL
      AND bc.price IS NOT NULL
      AND m.my_price::numeric > bc.price::numeric
  `);

  const rows = Array.from(result);

  // Compute review-count quartile on the user's store for the +2 review
  // bucket. Null-safe.
  const reviewCounts = rows
    .map((r) => r.review_count)
    .filter((n): n is number => typeof n === "number" && n > 0)
    .sort((a, b) => a - b);
  const quartileFloor =
    reviewCounts.length >= 4
      ? reviewCounts[Math.floor(reviewCounts.length * 0.75)]
      : null;

  function score(r: Row): number {
    let s = 0;
    if (r.is_bestseller) s += 3;
    const tagsLower = r.shopify_tags.map((t) => t.toLowerCase());
    if (tagsLower.some((t) => DEMAND_TAGS.includes(t))) s += 2;
    if (
      quartileFloor !== null &&
      typeof r.review_count === "number" &&
      r.review_count >= quartileFloor
    )
      s += 2;
    if (r.stockout_count >= 5) s += 2;
    if ((r.review_count ?? 0) >= 50) s += 1;
    return s;
  }

  const scored = rows
    .map((r) => {
      const my = Number(r.my_price);
      const comp = Number(r.best_competitor_price);
      const disadvantageAbs = my - comp;
      const disadvantagePct =
        comp > 0 ? Math.round((disadvantageAbs / comp) * 100) : 0;
      return {
        ...r,
        importance: score(r),
        disadvantageAbs,
        disadvantagePct,
      };
    })
    .sort(
      (a, b) =>
        b.importance - a.importance ||
        b.disadvantagePct - a.disadvantagePct,
    );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted font-mono">
            Action queue
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Opportunities
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted leading-relaxed">
            Products on{" "}
            <Link
              href={`/stores/${encodeURIComponent(mine.domain)}`}
              className="text-foreground underline-offset-4 hover:underline"
            >
              {mine.displayName ?? mine.domain}
            </Link>{" "}
            that are likely high-volume <em>and</em> priced higher than at
            least one tracked competitor. Sorted by importance, then by
            price-disadvantage %.
          </p>
        </div>
        <div className="rounded-lg border border-default bg-elevated px-4 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
            Opportunities found
          </div>
          <div className="mt-0.5 text-2xl font-semibold tracking-tight">
            {scored.length}
          </div>
        </div>
      </div>

      {scored.length === 0 ? (
        <EmptyState mine={mine.domain} />
      ) : (
        <div className="mt-10 overflow-hidden rounded-xl border border-default">
          <div className="grid grid-cols-[2.4fr_1fr_1fr_0.8fr_1.4fr_0.6fr] gap-3 border-b border-default bg-elevated px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
            <div>My product</div>
            <div>My price</div>
            <div>Best competitor</div>
            <div>Δ</div>
            <div>Demand signal</div>
            <div className="text-right">Score</div>
          </div>
          {scored.map((r) => (
            <Link
              key={r.id}
              href={`/products/${r.id}`}
              className="grid grid-cols-[2.4fr_1fr_1fr_0.8fr_1.4fr_0.6fr] gap-3 px-5 py-4 border-b border-default last:border-b-0 items-center hover:bg-elevated transition group"
            >
              {/* product */}
              <div className="flex items-center gap-3 min-w-0">
                {r.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.image_url}
                    alt=""
                    className="h-10 w-10 rounded-md bg-elevated object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-elevated flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium group-hover:text-signal transition">
                    {r.title ?? r.handle}
                  </div>
                  <div className="truncate text-[11px] text-muted font-mono">
                    {r.store_domain}
                  </div>
                </div>
              </div>

              {/* my price */}
              <div className="font-mono text-sm">
                {currencySymbol(r.currency)}
                {Number(r.my_price).toFixed(2)}
              </div>

              {/* best competitor */}
              <div className="min-w-0">
                <div className="font-mono text-sm">
                  {currencySymbol(r.best_competitor_currency ?? r.currency)}
                  {Number(r.best_competitor_price).toFixed(2)}
                </div>
                <div className="truncate text-[11px] text-muted font-mono">
                  {r.best_competitor_store}
                </div>
              </div>

              {/* delta */}
              <div className="font-mono text-sm">
                <span className="text-signal">+{r.disadvantagePct}%</span>
              </div>

              {/* demand signals */}
              <div className="flex flex-wrap gap-1">
                {r.is_bestseller && (
                  <SignalChip label="bestseller-collection" />
                )}
                {r.shopify_tags
                  .filter((t) => DEMAND_TAGS.includes(t.toLowerCase()))
                  .slice(0, 2)
                  .map((t) => (
                    <SignalChip key={t} label={`#${t.toLowerCase()}`} />
                  ))}
                {r.review_count !== null && r.review_count > 0 && (
                  <SignalChip label={`${r.review_count} reviews`} />
                )}
                {r.stockout_count >= 5 && (
                  <SignalChip label={`${r.stockout_count}× OOS`} />
                )}
              </div>

              {/* score */}
              <div className="text-right font-mono text-sm">
                {r.importance}
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-6 text-[11px] text-muted/80 font-mono uppercase tracking-[0.15em]">
        ·{" "}
        <span className="lowercase">
          Linking is required for a product to appear here. Use the{" "}
        </span>
        <Link
          href="/products/suggestions"
          className="text-foreground hover:underline underline-offset-4 lowercase"
        >
          Suggestions
        </Link>
        <span className="lowercase">
          {" "}page to link your products to competitor equivalents.
        </span>
      </p>
    </div>
  );
}

function SignalChip({ label }: { label: string }) {
  return (
    <span className="rounded border border-default bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted font-mono">
      {label}
    </span>
  );
}

function EmptyState({ mine }: { mine: string }) {
  return (
    <div className="mt-12 rounded-xl border border-dashed border-default bg-elevated px-6 py-10 text-center">
      <div className="text-sm font-medium text-foreground">
        No price-disadvantage opportunities right now.
      </div>
      <p className="mt-2 text-xs text-muted max-w-md mx-auto">
        Either your products on{" "}
        <span className="font-mono">{mine}</span> aren't linked to
        competitor equivalents yet, or you're cheaper than every linked
        competitor (good for you).
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          href="/products/suggestions"
          className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
        >
          Review link suggestions →
        </Link>
        <Link
          href={`/stores/${encodeURIComponent(mine)}`}
          className="rounded-md border border-default bg-surface px-4 py-2 text-sm hover:border-strong"
        >
          Open my store
        </Link>
      </div>
    </div>
  );
}

function NoStoreFlagged() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted font-mono">
        Setup required
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Mark your store first.
      </h1>
      <p className="mt-3 text-sm text-muted leading-relaxed">
        The Opportunities view compares your store's products against
        tracked competitors. Open a store you track and click "Mark as my
        store" — only the one you sell on, not the ones you watch.
      </p>
      <div className="mt-8">
        <Link
          href="/stores"
          className="rounded-md bg-signal px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600"
        >
          Choose my store →
        </Link>
      </div>
    </div>
  );
}

function currencySymbol(c: string) {
  switch (c) {
    case "GBP":
      return "£";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "CAD":
      return "CA$";
    case "AUD":
      return "A$";
    default:
      return c + " ";
  }
}
