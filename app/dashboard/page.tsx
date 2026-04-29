import Link from "next/link";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { RunNowButton } from "./run-now-button";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  store?: string;
  sort?: string;
  added?: string;
  failed?: string;
  dup?: string;
}>;

interface DashboardRow {
  id: string;
  url: string;
  handle: string;
  storeDomain: string;
  title: string | null;
  imageUrl: string | null;
  currency: string;
  active: boolean;
  lastCrawledAt: Date | null;
  latestPrice: { price: string; currency: string } | null;
  latestStock: { available: boolean; quantity: number | null } | null;
  priceChange24h: number | null;
}

async function getDashboardData(params: {
  q?: string;
  store?: string;
  sort?: string;
}): Promise<{ rows: DashboardRow[]; stores: string[] }> {
  type Row = {
    id: string;
    url: string;
    handle: string;
    store_domain: string;
    title: string | null;
    image_url: string | null;
    currency: string;
    active: boolean;
    added_at: string;
    last_crawled_at: string | null;
    latest_price: string | null;
    latest_currency: string | null;
    latest_available: boolean | null;
    latest_quantity: number | null;
    price_24h_ago: string | null;
  };

  const result = await db.execute<Row>(sql`
    SELECT
      p.id, p.url, p.handle, p.store_domain, p.title, p.image_url, p.currency,
      p.active, p.added_at, p.last_crawled_at,
      lp.price AS latest_price,
      lp.currency AS latest_currency,
      ls.available AS latest_available,
      ls.quantity AS latest_quantity,
      pp.price AS price_24h_ago
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
    ORDER BY p.added_at DESC
  `);

  const allStores = Array.from(
    new Set(result.map((r) => r.store_domain)),
  ).sort();

  let filtered: Row[] = Array.from(result);
  if (params.store) {
    filtered = filtered.filter((r) => r.store_domain === params.store);
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
      lastCrawledAt: r.last_crawled_at ? new Date(r.last_crawled_at) : null,
      latestPrice: r.latest_price
        ? { price: r.latest_price, currency: r.latest_currency ?? r.currency }
        : null,
      latestStock:
        r.latest_available !== null
          ? { available: r.latest_available, quantity: r.latest_quantity }
          : null,
      priceChange24h,
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
      case "added_asc":
      case "added_desc":
      default:
        return 0;
    }
  });
  if (sort === "added_asc") rows.reverse();

  return { rows, stores: allStores };
}

export default async function DashboardPage(props: {
  searchParams: SearchParams;
}) {
  const params = await props.searchParams;

  let rows: DashboardRow[] = [];
  let stores: string[] = [];
  let dbError: string | null = null;

  try {
    const data = await getDashboardData({
      q: params.q,
      store: params.store,
      sort: params.sort,
    });
    rows = data.rows;
    stores = data.stores;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const banner = buildBanner(params);

  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="block h-6 w-6 rounded-md bg-paper relative">
              <span className="absolute left-[6px] top-[6px] h-3 w-1 bg-ink" />
              <span className="absolute right-[6px] top-[6px] h-2 w-1 bg-signal" />
            </span>
            <span className="font-semibold tracking-tight">rivlr</span>
            <span className="ml-3 rounded bg-neutral-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400 font-mono">
              phase 1
            </span>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="text-xs text-neutral-400 hover:text-paper"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Tracked products
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              {dbError
                ? "Database not connected yet."
                : rows.length === 0 && !params.q && !params.store
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
          <div className="mt-6 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
            {banner}
          </div>
        )}

        {!dbError && (rows.length > 0 || stores.length > 0) && (
          <form
            method="get"
            className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3"
          >
            <input
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search products, handles, stores…"
              className="flex-1 min-w-[200px] rounded-md border border-neutral-700 bg-ink px-3 py-1.5 text-sm text-paper placeholder-neutral-500 outline-none focus:border-neutral-500"
            />
            <select
              name="store"
              defaultValue={params.store ?? ""}
              className="rounded-md border border-neutral-700 bg-ink px-3 py-1.5 text-sm text-paper outline-none focus:border-neutral-500"
            >
              <option value="">All stores</option>
              {stores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              name="sort"
              defaultValue={params.sort ?? "added_desc"}
              className="rounded-md border border-neutral-700 bg-ink px-3 py-1.5 text-sm text-paper outline-none focus:border-neutral-500"
            >
              <option value="added_desc">Newest first</option>
              <option value="added_asc">Oldest first</option>
              <option value="name_asc">Name A → Z</option>
              <option value="price_asc">Price low → high</option>
              <option value="price_desc">Price high → low</option>
              <option value="change_desc">Biggest price rise (24h)</option>
              <option value="change_asc">Biggest price drop (24h)</option>
            </select>
            <button
              type="submit"
              className="rounded-md bg-paper px-3 py-1.5 text-sm font-medium text-ink"
            >
              Apply
            </button>
            {(params.q || params.store || params.sort) && (
              <Link
                href="/dashboard"
                className="text-xs text-neutral-400 hover:text-paper"
              >
                Clear
              </Link>
            )}
          </form>
        )}

        {dbError ? (
          <div className="mt-12 rounded-xl border border-dashed border-neutral-800 px-8 py-10">
            <p className="text-sm text-neutral-300">
              Could not reach the database.
            </p>
            <p className="mt-3 text-xs text-neutral-500 font-mono">{dbError}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-neutral-800 px-8 py-16 text-center">
            <p className="text-neutral-300">
              {params.q || params.store
                ? "No products match those filters."
                : "No products yet."}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
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
          <div className="mt-6 overflow-hidden rounded-xl border border-neutral-800">
            <div className="grid grid-cols-[2.4fr_1fr_1.2fr_1fr_1fr] gap-3 border-b border-neutral-800 bg-neutral-900 px-5 py-3 text-[11px] uppercase tracking-wider text-neutral-500 font-mono">
              <div>Product</div>
              <div>Price</div>
              <div>Stock</div>
              <div className="text-right">Δ 24h</div>
              <div className="text-right">Last crawled</div>
            </div>
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/products/${r.id}`}
                className={`grid grid-cols-[2.4fr_1fr_1.2fr_1fr_1fr] items-center gap-3 border-b border-neutral-800 px-5 py-4 text-sm last:border-b-0 transition hover:bg-neutral-900/70 ${r.active ? "" : "opacity-50"}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {r.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded-md bg-neutral-800 object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-neutral-800 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {r.title ?? r.handle}
                      {!r.active && (
                        <span className="ml-2 rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400 font-mono">
                          paused
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-neutral-500 font-mono">
                      {r.storeDomain}
                    </div>
                  </div>
                </div>

                <div className="font-mono">
                  {r.latestPrice
                    ? `${currencySymbol(r.latestPrice.currency)}${r.latestPrice.price}`
                    : "—"}
                </div>

                <div>
                  {r.latestStock ? (
                    <span className="inline-flex items-center gap-2 text-sm">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          r.latestStock.available
                            ? "bg-green-500"
                            : "bg-signal"
                        }`}
                      />
                      {r.latestStock.available
                        ? r.latestStock.quantity !== null
                          ? `${r.latestStock.quantity} in stock`
                          : "In stock"
                        : "Out of stock"}
                    </span>
                  ) : (
                    "—"
                  )}
                </div>

                <div className={`text-right font-mono ${deltaColor(r.priceChange24h)}`}>
                  {r.priceChange24h === null
                    ? "—"
                    : r.priceChange24h === 0
                      ? "0"
                      : `${r.priceChange24h > 0 ? "+" : ""}${currencySymbol(r.currency)}${Math.abs(r.priceChange24h).toFixed(2)}`}
                </div>

                <div className="text-right text-xs text-neutral-500 font-mono">
                  {r.lastCrawledAt ? formatRelative(r.lastCrawledAt) : "pending"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
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

function currencySymbol(code: string) {
  switch (code) {
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
      return code + " ";
  }
}

function deltaColor(delta: number | null) {
  if (delta === null || delta === 0) return "text-neutral-500";
  return delta > 0 ? "text-signal" : "text-green-500";
}

function formatRelative(date: Date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
