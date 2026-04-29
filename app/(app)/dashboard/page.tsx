import Link from "next/link";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { RunNowButton } from "./run-now-button";
import { ProductsTable, type DashboardRow } from "./products-table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  store?: string;
  tag?: string;
  sort?: string;
  added?: string;
  failed?: string;
  dup?: string;
}>;

async function getDashboardData(params: {
  q?: string;
  store?: string;
  tag?: string;
  sort?: string;
}): Promise<{
  rows: DashboardRow[];
  stores: string[];
  tags: string[];
  hasAnyQuantityData: boolean;
}> {
  type Row = {
    id: string;
    url: string;
    handle: string;
    store_domain: string;
    title: string | null;
    image_url: string | null;
    currency: string;
    active: boolean;
    notify_stock_changes: boolean;
    notify_price_drops: boolean;
    tags: string[];
    added_at: string;
    last_crawled_at: string | null;
    latest_price: string | null;
    latest_currency: string | null;
    latest_available: boolean | null;
    latest_quantity: number | null;
    price_24h_ago: string | null;
    sold_30d: number | null;
  };

  const result = await db.execute<Row>(sql`
    WITH qty_changes AS (
      SELECT
        product_id,
        observed_at,
        quantity,
        LAG(quantity) OVER (PARTITION BY product_id ORDER BY observed_at) AS prev_qty
      FROM stock_observations
      WHERE quantity IS NOT NULL
        AND observed_at >= NOW() - INTERVAL '30 days'
    ),
    sold_30d_calc AS (
      SELECT
        product_id,
        SUM(
          CASE
            WHEN prev_qty IS NOT NULL AND prev_qty > quantity
            THEN prev_qty - quantity
            ELSE 0
          END
        )::int AS sold_30d
      FROM qty_changes
      GROUP BY product_id
    )
    SELECT
      p.id, p.url, p.handle, p.store_domain, p.title, p.image_url, p.currency,
      p.active, p.notify_stock_changes, p.notify_price_drops, p.tags,
      p.added_at, p.last_crawled_at,
      lp.price AS latest_price,
      lp.currency AS latest_currency,
      ls.available AS latest_available,
      ls.quantity AS latest_quantity,
      pp.price AS price_24h_ago,
      s.sold_30d
    FROM tracked_products p
    LEFT JOIN LATERAL (
      SELECT price, currency
      FROM price_observations
      WHERE product_id = p.id
      ORDER BY observed_at DESC
      LIMIT 1
    ) lp ON true
    LEFT JOIN LATERAL (
      SELECT available, quantity
      FROM stock_observations
      WHERE product_id = p.id
      ORDER BY observed_at DESC
      LIMIT 1
    ) ls ON true
    LEFT JOIN LATERAL (
      SELECT price
      FROM price_observations
      WHERE product_id = p.id AND observed_at < NOW() - INTERVAL '23 hours'
      ORDER BY observed_at DESC
      LIMIT 1
    ) pp ON true
    LEFT JOIN sold_30d_calc s ON s.product_id = p.id
    ORDER BY p.added_at DESC
  `);

  const allStores = Array.from(
    new Set(result.map((r) => r.store_domain)),
  ).sort();
  const allTags = Array.from(
    new Set(result.flatMap((r) => r.tags ?? [])),
  ).sort();
  const hasAnyQuantityData = result.some((r) => r.sold_30d !== null);

  let filtered: Row[] = Array.from(result);
  if (params.store) {
    filtered = filtered.filter((r) => r.store_domain === params.store);
  }
  if (params.tag) {
    filtered = filtered.filter((r) => (r.tags ?? []).includes(params.tag!));
  }
  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        (r.title ?? "").toLowerCase().includes(q) ||
        r.handle.toLowerCase().includes(q) ||
        r.store_domain.toLowerCase().includes(q),
    );
  }

  const rows: DashboardRow[] = filtered.map((r) => {
    const priceNow = r.latest_price ? Number(r.latest_price) : null;
    const priceBefore = r.price_24h_ago ? Number(r.price_24h_ago) : null;
    const priceChange24h =
      priceNow !== null && priceBefore !== null
        ? Number((priceNow - priceBefore).toFixed(2))
        : null;

    return {
      id: r.id,
      url: r.url,
      handle: r.handle,
      storeDomain: r.store_domain,
      title: r.title,
      imageUrl: r.image_url,
      currency: r.currency,
      active: r.active,
      notifyStockChanges: r.notify_stock_changes,
      notifyPriceDrops: r.notify_price_drops,
      tags: r.tags ?? [],
      lastCrawledAt: r.last_crawled_at,
      latestPrice: r.latest_price
        ? { price: r.latest_price, currency: r.latest_currency ?? r.currency }
        : null,
      latestStock:
        r.latest_available !== null
          ? { available: r.latest_available, quantity: r.latest_quantity }
          : null,
      priceChange24h,
      sold30d: r.sold_30d,
    };
  });

  const sort = params.sort ?? "added_desc";
  rows.sort((a, b) => {
    switch (sort) {
      case "name_asc":
        return (a.title ?? a.handle).localeCompare(b.title ?? b.handle);
      case "price_asc":
        return (
          (a.latestPrice ? Number(a.latestPrice.price) : Infinity) -
          (b.latestPrice ? Number(b.latestPrice.price) : Infinity)
        );
      case "price_desc":
        return (
          (b.latestPrice ? Number(b.latestPrice.price) : -Infinity) -
          (a.latestPrice ? Number(a.latestPrice.price) : -Infinity)
        );
      case "change_desc":
        return (b.priceChange24h ?? 0) - (a.priceChange24h ?? 0);
      case "change_asc":
        return (a.priceChange24h ?? 0) - (b.priceChange24h ?? 0);
      case "sold_desc":
        return (b.sold30d ?? -1) - (a.sold30d ?? -1);
      case "sold_asc":
        return (a.sold30d ?? Infinity) - (b.sold30d ?? Infinity);
      case "added_asc":
      case "added_desc":
      default:
        return 0;
    }
  });
  if (sort === "added_asc") rows.reverse();

  return { rows, stores: allStores, tags: allTags, hasAnyQuantityData };
}

export default async function DashboardPage(props: {
  searchParams: SearchParams;
}) {
  const params = await props.searchParams;

  let rows: DashboardRow[] = [];
  let stores: string[] = [];
  let tags: string[] = [];
  let hasAnyQuantityData = false;
  let dbError: string | null = null;

  try {
    const data = await getDashboardData({
      q: params.q,
      store: params.store,
      tag: params.tag,
      sort: params.sort,
    });
    rows = data.rows;
    stores = data.stores;
    tags = data.tags;
    hasAnyQuantityData = data.hasAnyQuantityData;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const banner = buildBanner(params);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Tracked products
          </h1>
          <p className="mt-1 text-sm text-muted">
            {dbError
              ? "Database not connected yet."
              : rows.length === 0 && !params.q && !params.store && !params.tag
                ? "Nothing tracked yet."
                : `${rows.length} product${rows.length === 1 ? "" : "s"} · daily crawl at 04:00 GMT`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <RunNowButton />
          <Link
            href="/products/new"
            className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
          >
            + Add products
          </Link>
        </div>
      </div>

      {banner && (
        <div className="mt-6 rounded-md border border-default bg-elevated px-4 py-3 text-sm text-muted-strong">
          {banner}
        </div>
      )}

      {!dbError && (rows.length > 0 || stores.length > 0) && (
        <form
          method="get"
          className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-default bg-elevated px-4 py-3"
        >
          <input
            type="search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search products, handles, stores…"
            className="flex-1 min-w-[200px] rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground placeholder-muted outline-none focus:border-strong"
          />
          <select
            name="store"
            defaultValue={params.store ?? ""}
            className="rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-strong"
          >
            <option value="">All stores</option>
            {stores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {tags.length > 0 && (
            <select
              name="tag"
              defaultValue={params.tag ?? ""}
              className="rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-strong"
            >
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          )}
          <select
            name="sort"
            defaultValue={params.sort ?? "added_desc"}
            className="rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-strong"
          >
            <option value="added_desc">Newest first</option>
            <option value="added_asc">Oldest first</option>
            <option value="name_asc">Name A → Z</option>
            <option value="price_asc">Price low → high</option>
            <option value="price_desc">Price high → low</option>
            <option value="change_desc">Biggest price rise (24h)</option>
            <option value="change_asc">Biggest price drop (24h)</option>
            {hasAnyQuantityData && (
              <>
                <option value="sold_desc">Most sold (30d)</option>
                <option value="sold_asc">Least sold (30d)</option>
              </>
            )}
          </select>
          <button
            type="submit"
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-surface"
          >
            Apply
          </button>
          {(params.q || params.store || params.tag || params.sort) && (
            <Link
              href="/dashboard"
              className="text-xs text-muted hover:text-foreground"
            >
              Clear
            </Link>
          )}
        </form>
      )}

      {dbError ? (
        <div className="mt-12 rounded-xl border border-dashed border-default px-8 py-10">
          <p className="text-sm text-muted-strong">
            Could not reach the database.
          </p>
          <p className="mt-3 text-xs text-muted font-mono">{dbError}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-default px-8 py-16 text-center">
          <p className="text-muted-strong">
            {params.q || params.store || params.tag
              ? "No products match those filters."
              : "No products yet."}
          </p>
          <p className="mt-1 text-sm text-muted">
            Paste one or more Shopify product URLs to start tracking.
          </p>
          <Link
            href="/products/new"
            className="mt-6 inline-block rounded-md bg-signal px-4 py-2 text-sm font-medium text-white"
          >
            Add products
          </Link>
        </div>
      ) : (
        <ProductsTable rows={rows} showSold={hasAnyQuantityData} />
      )}
    </section>
  );
}

function buildBanner(params: {
  added?: string;
  failed?: string;
  dup?: string;
}) {
  const added = Number(params.added ?? 0);
  const failed = Number(params.failed ?? 0);
  const dup = Number(params.dup ?? 0);
  if (!added && !failed && !dup) return null;
  const parts: string[] = [];
  if (added) parts.push(`✓ ${added} added`);
  if (dup) parts.push(`${dup} duplicate${dup === 1 ? "" : "s"} skipped`);
  if (failed) parts.push(`${failed} failed`);
  return parts.join(" · ");
}
