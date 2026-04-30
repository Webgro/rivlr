import Link from "next/link";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type SearchParams = Promise<{
  kind?: string;
  store?: string;
  page?: string;
}>;

interface ActivityItem {
  productId: string;
  title: string | null;
  handle: string;
  storeDomain: string;
  currency: string;
  kind: "stock_out" | "stock_in" | "price_drop" | "price_rise";
  observedAt: Date;
  prevPrice?: number;
  newPrice?: number;
}

async function getActivity(params: {
  kind?: string;
  store?: string;
  page: number;
}): Promise<{ items: ActivityItem[]; totalCount: number; stores: string[] }> {
  type Row = {
    product_id: string;
    title: string | null;
    handle: string;
    store_domain: string;
    currency: string;
    kind: ActivityItem["kind"];
    observed_at: string;
    prev_price: string | null;
    new_price: string | null;
  };

  // Pull all changes from last 30 days (capped at a few thousand to keep
  // the query fast). Filter in memory for v1 — can move to SQL filtering
  // when scale demands.
  const result = await db.execute<Row>(sql`
    WITH price_changes AS (
      SELECT
        po.product_id,
        po.observed_at,
        po.price AS new_price,
        prev.price AS prev_price
      FROM price_observations po
      LEFT JOIN LATERAL (
        SELECT price FROM price_observations
        WHERE product_id = po.product_id AND observed_at < po.observed_at
        ORDER BY observed_at DESC LIMIT 1
      ) prev ON true
      WHERE po.observed_at >= NOW() - INTERVAL '30 days'
        AND prev.price IS NOT NULL
        AND prev.price::numeric != po.price::numeric
    ),
    stock_changes AS (
      SELECT
        so.product_id,
        so.observed_at,
        so.available AS new_avail,
        prev.available AS prev_avail
      FROM stock_observations so
      LEFT JOIN LATERAL (
        SELECT available FROM stock_observations
        WHERE product_id = so.product_id AND observed_at < so.observed_at
        ORDER BY observed_at DESC LIMIT 1
      ) prev ON true
      WHERE so.observed_at >= NOW() - INTERVAL '30 days'
        AND prev.available IS NOT NULL
        AND prev.available != so.available
    )
    SELECT
      pc.product_id, p.title, p.handle, p.store_domain, p.currency,
      CASE WHEN pc.new_price::numeric < pc.prev_price::numeric
           THEN 'price_drop' ELSE 'price_rise' END AS kind,
      pc.observed_at,
      pc.prev_price::text AS prev_price,
      pc.new_price::text AS new_price
    FROM price_changes pc
    JOIN tracked_products p ON p.id = pc.product_id
    UNION ALL
    SELECT
      sc.product_id, p.title, p.handle, p.store_domain, p.currency,
      CASE WHEN sc.new_avail = false THEN 'stock_out' ELSE 'stock_in' END AS kind,
      sc.observed_at,
      NULL AS prev_price,
      NULL AS new_price
    FROM stock_changes sc
    JOIN tracked_products p ON p.id = sc.product_id
    ORDER BY observed_at DESC
    LIMIT 5000
  `);

  let all: ActivityItem[] = Array.from(result).map((r) => ({
    productId: r.product_id,
    title: r.title,
    handle: r.handle,
    storeDomain: r.store_domain,
    currency: r.currency,
    kind: r.kind,
    observedAt: new Date(r.observed_at),
    prevPrice: r.prev_price ? Number(r.prev_price) : undefined,
    newPrice: r.new_price ? Number(r.new_price) : undefined,
  }));

  if (params.kind) all = all.filter((a) => a.kind === params.kind);
  if (params.store) all = all.filter((a) => a.storeDomain === params.store);

  const stores = Array.from(
    new Set(Array.from(result).map((r) => r.store_domain)),
  ).sort();

  const totalCount = all.length;
  const start = (params.page - 1) * PAGE_SIZE;
  const items = all.slice(start, start + PAGE_SIZE);

  return { items, totalCount, stores };
}

export default async function ActivityPage(props: {
  searchParams: SearchParams;
}) {
  const params = await props.searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const { items, totalCount, stores } = await getActivity({
    kind: params.kind,
    store: params.store,
    page,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
      <p className="mt-1 text-sm text-muted">
        Every detected price and stock change in the last 30 days.
      </p>

      <form
        method="get"
        key={`${params.kind ?? ""}|${params.store ?? ""}`}
        className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-default bg-elevated px-4 py-3"
      >
        <select
          name="kind"
          defaultValue={params.kind ?? ""}
          className="rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-strong"
        >
          <option value="">All events</option>
          <option value="stock_out">Out of stock</option>
          <option value="stock_in">Restocked</option>
          <option value="price_drop">Price drop</option>
          <option value="price_rise">Price rise</option>
        </select>
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
        <button
          type="submit"
          className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-surface"
        >
          Apply
        </button>
        {(params.kind || params.store) && (
          <Link
            href="/activity"
            className="text-xs text-muted hover:text-foreground"
          >
            Clear
          </Link>
        )}
        <span className="ml-auto text-xs text-muted font-mono">
          {totalCount} event{totalCount === 1 ? "" : "s"}
        </span>
      </form>

      {items.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-default px-8 py-12 text-center text-sm text-muted">
          No activity in this filter. Stock and price changes appear here as
          they happen.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-default">
          {items.map((item, i) => (
            <ActivityRowItem key={i} item={item} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-default bg-elevated px-4 py-3">
          <Link
            href={pageHref(page - 1, params)}
            aria-disabled={page === 1}
            className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page === 1 ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
          >
            ← Previous
          </Link>
          <span className="text-xs text-muted font-mono">
            Page {page} of {totalPages}
          </span>
          <Link
            href={pageHref(page + 1, params)}
            aria-disabled={page === totalPages}
            className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page === totalPages ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
          >
            Next →
          </Link>
        </div>
      )}
    </section>
  );
}

function pageHref(
  p: number,
  params: { kind?: string; store?: string },
): string {
  const sp = new URLSearchParams();
  if (params.kind) sp.set("kind", params.kind);
  if (params.store) sp.set("store", params.store);
  if (p > 1) sp.set("page", String(p));
  const q = sp.toString();
  return `/activity${q ? "?" + q : ""}`;
}

function ActivityRowItem({ item }: { item: ActivityItem }) {
  const symbol = currencySymbol(item.currency);
  const time = formatRelative(item.observedAt);

  let label: React.ReactNode;
  let icon: string;
  let iconClass: string;
  switch (item.kind) {
    case "stock_out":
      icon = "⊘";
      iconClass = "text-signal";
      label = "Out of stock";
      break;
    case "stock_in":
      icon = "↑";
      iconClass = "text-green-500";
      label = "Restocked";
      break;
    case "price_drop":
      icon = "↓";
      iconClass = "text-green-500";
      label = (
        <>
          Price drop{" "}
          <span className="font-mono">
            ({symbol}
            {item.prevPrice?.toFixed(2)} → {symbol}
            {item.newPrice?.toFixed(2)})
          </span>
        </>
      );
      break;
    case "price_rise":
      icon = "↑";
      iconClass = "text-signal";
      label = (
        <>
          Price up{" "}
          <span className="font-mono">
            ({symbol}
            {item.prevPrice?.toFixed(2)} → {symbol}
            {item.newPrice?.toFixed(2)})
          </span>
        </>
      );
      break;
  }

  return (
    <Link
      href={`/products/${item.productId}`}
      className="grid grid-cols-[16px_1fr_auto] items-center gap-3 border-b border-default px-4 py-3 last:border-b-0 hover:bg-elevated text-sm"
    >
      <span className={`font-mono text-base ${iconClass}`}>{icon}</span>
      <div className="min-w-0">
        <div className="truncate text-xs">{label}</div>
        <div className="truncate font-medium">
          {item.title ?? item.handle}
          <span className="text-muted font-mono ml-2 text-xs">
            {item.storeDomain}
          </span>
        </div>
      </div>
      <span className="text-xs text-muted font-mono whitespace-nowrap">
        {time}
      </span>
    </Link>
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
    default:
      return c + " ";
  }
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
