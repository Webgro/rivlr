import Link from "next/link";
import { db, schema, type TagColor } from "@/lib/db";
import { sql } from "drizzle-orm";
import { RunNowButton } from "./run-now-button";
import { ProductsTable, type DashboardRow } from "./products-table";
import { InsightsRow } from "./insights-row";
import { getDashboardInsights } from "@/lib/dashboard-insights";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type StockFilter = "in" | "out" | "low" | undefined;

type SearchParams = Promise<{
  q?: string;
  store?: string;
  tag?: string;
  stock?: string;
  sort?: string;
  page?: string;
  fav?: string;
  added?: string;
  failed?: string;
  dup?: string;
  col?: string;
  exp?: string;
}>;

async function getDashboardData(params: {
  q?: string;
  store?: string;
  tag?: string;
  stock?: StockFilter;
  sort?: string;
  fav?: boolean;
  page: number;
}): Promise<{
  rows: DashboardRow[];
  stores: string[];
  tags: string[];
  tagColors: Record<string, TagColor>;
  availableTags: Array<{ name: string; color: TagColor }>;
  hasAnyQuantityData: boolean;
  totalCount: number;
  totalPages: number;
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
    is_favourite: boolean;
    tags: string[];
    added_at: string;
    last_crawled_at: string | null;
    latest_price: string | null;
    latest_currency: string | null;
    latest_available: boolean | null;
    latest_quantity: number | null;
    price_24h_ago: string | null;
    sold_30d: number | null;
    oos_since: string | null;
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
    ),
    /*
      Stock-out duration: find the earliest observation in the most recent
      contiguous 'out of stock' run for each product. If the latest
      observation is in_stock, this returns null.
    */
    oos_runs AS (
      SELECT
        product_id,
        observed_at,
        available,
        SUM(CASE WHEN available THEN 1 ELSE 0 END)
          OVER (PARTITION BY product_id ORDER BY observed_at DESC) AS run_grp
      FROM stock_observations
    ),
    oos_since_calc AS (
      SELECT product_id, MIN(observed_at) AS oos_since
      FROM oos_runs
      WHERE run_grp = 0 AND available = false
      GROUP BY product_id
    )
    SELECT
      p.id, p.url, p.handle, p.store_domain, p.title, p.image_url, p.currency,
      p.active, p.notify_stock_changes, p.notify_price_drops, p.is_favourite, p.tags,
      p.added_at, p.last_crawled_at,
      lp.price AS latest_price,
      lp.currency AS latest_currency,
      ls.available AS latest_available,
      ls.quantity AS latest_quantity,
      pp.price AS price_24h_ago,
      s.sold_30d,
      oos.oos_since
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
    LEFT JOIN oos_since_calc oos ON oos.product_id = p.id
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
  if (params.stock === "in") {
    filtered = filtered.filter((r) => r.latest_available === true);
  } else if (params.stock === "out") {
    filtered = filtered.filter((r) => r.latest_available === false);
  } else if (params.stock === "low") {
    // Low stock = available but quantity is exposed and < 10. Excludes products
    // where the store doesn't publish quantities (we can't tell).
    filtered = filtered.filter(
      (r) =>
        r.latest_available === true &&
        r.latest_quantity !== null &&
        r.latest_quantity > 0 &&
        r.latest_quantity < 10,
    );
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
  if (params.fav) {
    filtered = filtered.filter((r) => r.is_favourite);
  }

  const rows: DashboardRow[] = filtered.map((r) => {
    const priceNow = r.latest_price ? Number(r.latest_price) : null;
    const priceBefore = r.price_24h_ago ? Number(r.price_24h_ago) : null;
    const priceChange24h =
      priceNow !== null && priceBefore !== null
        ? Number((priceNow - priceBefore).toFixed(2))
        : null;

    const oosSince = r.oos_since ? new Date(r.oos_since) : null;
    const oosDays = oosSince
      ? Math.max(
          0,
          Math.floor((Date.now() - oosSince.getTime()) / 86_400_000),
        )
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
      isFavourite: r.is_favourite,
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
      oosDays,
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
      case "qty_desc":
        return (
          (b.latestStock?.quantity ?? -1) - (a.latestStock?.quantity ?? -1)
        );
      case "qty_asc":
        return (
          (a.latestStock?.quantity ?? Infinity) -
          (b.latestStock?.quantity ?? Infinity)
        );
      case "added_asc":
      case "added_desc":
      default:
        return 0;
    }
  });
  if (sort === "added_asc") rows.reverse();

  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const start = (params.page - 1) * PAGE_SIZE;
  const paged = rows.slice(start, start + PAGE_SIZE);

  // Tag colour map + the canonical list of available tags (used by the
  // bulk-add dropdown — only registered tags can be applied).
  const tagMeta = await db
    .select({ name: schema.tags.name, color: schema.tags.color })
    .from(schema.tags);
  const tagColors: Record<string, TagColor> = {};
  const availableTags: Array<{ name: string; color: TagColor }> = [];
  for (const t of tagMeta) {
    const color = (t.color as TagColor) ?? "gray";
    tagColors[t.name] = color;
    availableTags.push({ name: t.name, color });
  }
  availableTags.sort((a, b) => a.name.localeCompare(b.name));

  return {
    rows: paged,
    stores: allStores,
    tags: allTags,
    tagColors,
    availableTags,
    hasAnyQuantityData,
    totalCount,
    totalPages,
  };
}

export default async function DashboardPage(props: {
  searchParams: SearchParams;
}) {
  const params = await props.searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  let rows: DashboardRow[] = [];
  let stores: string[] = [];
  let tags: string[] = [];
  let tagColors: Record<string, TagColor> = {};
  let availableTags: Array<{ name: string; color: TagColor }> = [];
  let hasAnyQuantityData = false;
  let totalCount = 0;
  let totalPages = 1;
  let dbError: string | null = null;

  try {
    const data = await getDashboardData({
      q: params.q,
      store: params.store,
      tag: params.tag,
      stock: parseStockFilter(params.stock),
      sort: params.sort,
      fav: params.fav === "1",
      page,
    });
    rows = data.rows;
    stores = data.stores;
    tags = data.tags;
    tagColors = data.tagColors;
    availableTags = data.availableTags;
    hasAnyQuantityData = data.hasAnyQuantityData;
    totalCount = data.totalCount;
    totalPages = data.totalPages;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const banner = buildBanner(params);

  const insights = await getDashboardInsights().catch(() => null);

  // Build CSV export URL preserving current filters.
  const exportParams = new URLSearchParams();
  if (params.q) exportParams.set("q", params.q);
  if (params.store) exportParams.set("store", params.store);
  if (params.tag) exportParams.set("tag", params.tag);
  if (params.stock) exportParams.set("stock", params.stock);
  const exportHref = `/api/dashboard/export${exportParams.toString() ? "?" + exportParams.toString() : ""}`;

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
              : totalCount === 0 && !params.q && !params.store && !params.tag
                ? "Nothing tracked yet."
                : totalPages > 1
                  ? `${totalCount} product${totalCount === 1 ? "" : "s"} · page ${page} of ${totalPages}`
                  : `${totalCount} product${totalCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={exportHref}
            className="rounded-md border border-default bg-elevated px-3 py-2 text-sm hover:border-strong"
            title="Download CSV of the current view"
          >
            ↓ CSV
          </a>
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

      {insights && <InsightsRow insights={insights} />}

      {!dbError && (rows.length > 0 || stores.length > 0) && (
        <form
          method="get"
          // Force form remount when URL params change so the select inputs
          // reflect the current sort/filter values (defaultValue only applies
          // on initial mount — without this, soft nav would leave stale
          // visual state behind even though the URL is correct).
          key={`${params.q ?? ""}|${params.store ?? ""}|${params.tag ?? ""}|${params.stock ?? ""}|${params.sort ?? ""}|${params.fav ?? ""}`}
          className="mt-6 rounded-lg border border-default bg-elevated p-3 space-y-3"
        >
          {/* Top row: search field full-width with submit button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21 L16.65 16.65" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                name="q"
                defaultValue={params.q ?? ""}
                placeholder="Search products, handles, stores…"
                className="w-full rounded-md border border-default bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder-muted outline-none focus:border-strong"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
            >
              Apply
            </button>
          </div>

          {/* Second row: filter dropdowns + favourite chip */}
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              name="store"
              value={params.store ?? ""}
              defaultLabel="All stores"
              options={stores.map((s) => ({ value: s, label: s }))}
            />
            {tags.length > 0 && (
              <FilterSelect
                name="tag"
                value={params.tag ?? ""}
                defaultLabel="All tags"
                options={tags.map((t) => ({ value: t, label: `#${t}` }))}
              />
            )}
            <FilterSelect
              name="stock"
              value={params.stock ?? ""}
              defaultLabel="All stock"
              options={[
                { value: "in", label: "In stock" },
                { value: "out", label: "Out of stock" },
                ...(hasAnyQuantityData
                  ? [{ value: "low", label: "Low stock (<10)" }]
                  : []),
              ]}
            />
            <label
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium cursor-pointer transition select-none ${
                params.fav === "1"
                  ? "border-yellow-400/50 bg-yellow-400/10 text-yellow-400"
                  : "border-default bg-surface text-muted hover:border-strong hover:text-foreground"
              }`}
            >
              <input
                type="checkbox"
                name="fav"
                value="1"
                defaultChecked={params.fav === "1"}
                className="sr-only"
              />
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill={params.fav === "1" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              >
                <path d="M12 2 L14.5 8.5 L21 9.5 L16 14 L17.5 21 L12 17.5 L6.5 21 L8 14 L3 9.5 L9.5 8.5 Z" />
              </svg>
              Favourites
            </label>

            {/* Spacer pushes Sort to the right edge */}
            <div className="flex-1" />

            <span className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
              Sort
            </span>
            <select
              name="sort"
              defaultValue={params.sort ?? "added_desc"}
              className="rounded-md border border-default bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:border-strong cursor-pointer"
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
                  <option value="qty_desc">Quantity high → low</option>
                  <option value="qty_asc">Quantity low → high</option>
                  <option value="sold_desc">Most sold (30d)</option>
                  <option value="sold_asc">Least sold (30d)</option>
                </>
              )}
            </select>
          </div>
          {(params.q ||
            params.store ||
            params.tag ||
            params.stock ||
            params.sort) && (
            <Link
              href="/products"
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
        <>
          <ProductsTable
            rows={rows}
            showSold={hasAnyQuantityData}
            tagColors={tagColors}
            availableTags={availableTags}
            totalCount={totalCount}
          />
          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              params={params}
            />
          )}
        </>
      )}
    </section>
  );
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: { q?: string; store?: string; tag?: string; sort?: string };
}) {
  function pageHref(p: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.store) sp.set("store", params.store);
    if (params.tag) sp.set("tag", params.tag);
    if (params.sort) sp.set("sort", params.sort);
    if (p > 1) sp.set("page", String(p));
    const q = sp.toString();
    return `/dashboard${q ? "?" + q : ""}`;
  }

  // Build a windowed page list: 1, 2, …, current-1, current, current+1, …, last
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
  const visible = Array.from(pages).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  for (let i = 0; i < visible.length; i++) {
    if (i > 0 && visible[i] - visible[i - 1] > 1) items.push("gap");
    items.push(visible[i]);
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-default bg-elevated px-4 py-3"
    >
      <Link
        href={page > 1 ? pageHref(page - 1) : "#"}
        aria-disabled={page === 1}
        className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page === 1 ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
      >
        ← Previous
      </Link>

      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) =>
          item === "gap" ? (
            <span key={`gap-${i}`} className="text-muted text-sm">
              …
            </span>
          ) : (
            <Link
              key={item}
              href={pageHref(item)}
              aria-current={item === page ? "page" : undefined}
              className={`min-w-[36px] rounded-md px-2 py-1 text-center text-sm font-mono transition ${
                item === page
                  ? "bg-foreground text-surface"
                  : "border border-default hover:border-strong"
              }`}
            >
              {item}
            </Link>
          ),
        )}
      </div>

      <Link
        href={page < totalPages ? pageHref(page + 1) : "#"}
        aria-disabled={page === totalPages}
        className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page === totalPages ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
      >
        Next →
      </Link>
    </nav>
  );
}

function parseStockFilter(s: string | undefined): StockFilter {
  if (s === "in" || s === "out" || s === "low") return s;
  return undefined;
}

function buildBanner(params: {
  added?: string;
  failed?: string;
  dup?: string;
  col?: string;
  exp?: string;
}) {
  const added = Number(params.added ?? 0);
  const failed = Number(params.failed ?? 0);
  const dup = Number(params.dup ?? 0);
  const col = Number(params.col ?? 0);
  const exp = Number(params.exp ?? 0);
  if (!added && !failed && !dup && !col) return null;
  const parts: string[] = [];
  if (col > 0)
    parts.push(
      `${col} collection${col === 1 ? "" : "s"} expanded → ${exp} product${exp === 1 ? "" : "s"}`,
    );
  if (added) parts.push(`✓ ${added} added`);
  if (dup) parts.push(`${dup} duplicate${dup === 1 ? "" : "s"} skipped`);
  if (failed) parts.push(`${failed} failed`);
  return parts.join(" · ");
}

/**
 * Compact filter dropdown used in the products page filter bar. Smaller
 * padding + uppercase labels match the rest of the new dense layout.
 */
function FilterSelect({
  name,
  value,
  defaultLabel,
  options,
}: {
  name: string;
  value: string;
  defaultLabel: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium outline-none cursor-pointer transition focus:border-strong ${
        value
          ? "border-signal/40 bg-signal/[0.06] text-signal"
          : "border-default bg-surface text-foreground hover:border-strong"
      }`}
    >
      <option value="">{defaultLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
