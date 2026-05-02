import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { FavouriteStar } from "../products/favourite-star";
import { LinkProductButton } from "../products/[id]/link-product-button";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string | null;
  handle: string;
  store_domain: string;
  image_url: string | null;
  currency: string;
  is_favourite: boolean;
  latest_price: string | null;
  latest_available: boolean | null;
  latest_quantity: number | null;
  best_competitor_price: string | null;
  best_competitor_currency: string | null;
  best_competitor_store: string | null;
  is_grouped: boolean;
};

/**
 * /my-products — the user's own catalogue. Branched off from the main
 * tracked-products list because:
 *  - It doesn't make sense for the user's own products to count toward
 *    their plan limit (those are competitor watch slots).
 *  - The view here is comparison-focused: my price vs the cheapest
 *    linked competitor, side by side.
 *  - Own products auto-import via the daily catalogue scan when a store
 *    is marked as "mine" — the user doesn't add them manually.
 *
 * If no my-store is flagged, render a setup CTA.
 */
export default async function MyProductsPage() {
  const [mine] = await db
    .select()
    .from(schema.stores)
    .where(eq(schema.stores.isMyStore, true))
    .limit(1);

  if (!mine) return <NoStoreFlagged />;

  const result = await db.execute<Row>(sql`
    SELECT
      p.id, p.title, p.handle, p.store_domain, p.image_url, p.currency,
      p.is_favourite,
      lp.price AS latest_price,
      ls.available AS latest_available,
      ls.quantity AS latest_quantity,
      bc.price AS best_competitor_price,
      bc.currency AS best_competitor_currency,
      bc.store_domain AS best_competitor_store,
      (p.group_id IS NOT NULL) AS is_grouped
    FROM tracked_products p
    LEFT JOIN LATERAL (
      SELECT price FROM price_observations
      WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
    ) lp ON true
    LEFT JOIN LATERAL (
      SELECT available, quantity FROM stock_observations
      WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
    ) ls ON true
    LEFT JOIN LATERAL (
      SELECT c.store_domain, c.currency, cp.price
      FROM tracked_products c
      JOIN price_observations cp
        ON cp.product_id = c.id
      WHERE c.group_id = p.group_id
        AND c.id != p.id
        AND c.store_domain != p.store_domain
        AND p.group_id IS NOT NULL
      ORDER BY cp.observed_at DESC, cp.price ASC
      LIMIT 1
    ) bc ON true
    WHERE p.store_domain = ${mine.domain}
      AND p.active = true
    ORDER BY p.is_favourite DESC, p.added_at DESC
  `);
  const rows = Array.from(result);

  // Summary stats.
  const total = rows.length;
  const linked = rows.filter((r) => r.is_grouped).length;
  const undercut = rows.filter((r) => {
    if (!r.latest_price || !r.best_competitor_price) return false;
    return Number(r.latest_price) > Number(r.best_competitor_price);
  }).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted font-mono">
            Your catalogue
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            My products
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted leading-relaxed">
            Products on{" "}
            <Link
              href={`/stores/${encodeURIComponent(mine.domain)}`}
              className="text-foreground underline-offset-4 hover:underline"
            >
              {mine.displayName ?? mine.domain}
            </Link>
            . Auto-imported, free, and don&apos;t count toward your tracking
            limit. Linked competitor prices appear here so you can spot
            where you&apos;re winning, matching, or losing.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Stat label="Products" value={total.toString()} />
          <Stat
            label="Linked to competitor"
            value={`${linked} / ${total}`}
          />
          <Stat
            label="Currently undercut"
            value={undercut.toString()}
            tone={undercut > 0 ? "bad" : "neutral"}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-default bg-elevated px-6 py-10 text-center">
          <div className="text-sm font-medium">
            No products yet on {mine.displayName ?? mine.domain}.
          </div>
          <p className="mt-2 text-xs text-muted max-w-md mx-auto">
            We auto-import your store&apos;s catalogue on the next 05:00
            UTC scan. Or trigger a discovery run from the Discover page.
          </p>
          <div className="mt-5">
            <Link
              href="/discover"
              className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
            >
              Run discovery now
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-10 overflow-hidden rounded-xl border border-default">
          <div className="grid grid-cols-[28px_28px_minmax(0,2.4fr)_1fr_1fr_1fr_0.8fr] gap-3 border-b border-default bg-elevated px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
            <div></div>
            <div></div>
            <div>Product</div>
            <div>My price</div>
            <div>Best competitor</div>
            <div className="text-right">Δ</div>
            <div className="text-right">Stock</div>
          </div>
          {rows.map((r) => {
            const myPrice = r.latest_price ? Number(r.latest_price) : null;
            const compPrice = r.best_competitor_price
              ? Number(r.best_competitor_price)
              : null;
            const deltaPct =
              myPrice !== null && compPrice !== null && compPrice > 0
                ? Math.round(((myPrice - compPrice) / compPrice) * 100)
                : null;
            return (
              <div
                key={r.id}
                className="grid grid-cols-[28px_28px_minmax(0,2.4fr)_1fr_1fr_1fr_0.8fr] gap-3 px-5 py-4 border-b border-default last:border-b-0 items-center hover:bg-elevated transition"
              >
                <div></div>
                <FavouriteStar id={r.id} initial={r.is_favourite} />
                <Link
                  href={`/products/${r.id}`}
                  className="flex items-center gap-3 min-w-0 group"
                >
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
                    {!r.is_grouped && (
                      <div className="truncate text-[10px] text-muted/70 font-mono uppercase tracking-[0.15em]">
                        Not linked yet
                      </div>
                    )}
                  </div>
                </Link>
                <div className="font-mono text-sm">
                  {myPrice !== null
                    ? `${currencySymbol(r.currency)}${myPrice.toFixed(2)}`
                    : "—"}
                </div>
                <div className="min-w-0">
                  {compPrice !== null ? (
                    <>
                      <div className="font-mono text-sm">
                        {currencySymbol(
                          r.best_competitor_currency ?? r.currency,
                        )}
                        {compPrice.toFixed(2)}
                      </div>
                      <div className="truncate text-[11px] text-muted font-mono">
                        {r.best_competitor_store}
                      </div>
                    </>
                  ) : (
                    <LinkProductButton
                      productId={r.id}
                      excludeOwnStore
                      modalTitle={`Link "${r.title ?? r.handle}" to a competitor`}
                      myPrice={myPrice}
                      myCurrency={r.currency}
                      triggerLabel="+ Link"
                      triggerClassName="rounded-md border border-signal/40 bg-signal/5 text-signal px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.15em] hover:bg-signal/10 transition"
                    />
                  )}
                </div>
                <div className="text-right font-mono text-sm">
                  {deltaPct === null ? (
                    <span className="text-muted">—</span>
                  ) : deltaPct > 0 ? (
                    <span className="text-signal">+{deltaPct}%</span>
                  ) : deltaPct < 0 ? (
                    <span className="text-green-500">{deltaPct}%</span>
                  ) : (
                    <span className="text-muted">±0%</span>
                  )}
                </div>
                <div className="text-right text-xs">
                  {r.latest_available === null ? (
                    <span className="text-muted">—</span>
                  ) : r.latest_available ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                      {r.latest_quantity !== null
                        ? `${r.latest_quantity}`
                        : "In"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-signal">
                      <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                      Out
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-[11px] text-muted/80 font-mono uppercase tracking-[0.15em]">
        · Own-store products are free and don&apos;t count toward your
        plan&apos;s tracking limit.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const valueClass =
    tone === "bad"
      ? "text-signal"
      : tone === "good"
        ? "text-green-500"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-default bg-elevated px-4 py-2.5 min-w-[110px]">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-semibold tracking-tight ${valueClass}`}>
        {value}
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
        Tell us which store is yours.
      </h1>
      <p className="mt-3 text-sm text-muted leading-relaxed">
        Your own products are free and don&apos;t count toward your
        plan&apos;s tracking limit. Once you mark a store as yours, Rivlr
        auto-imports its catalogue here for side-by-side comparison
        against competitors.
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
