import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq, sql, desc } from "drizzle-orm";
import { scanStoreNow } from "@/lib/crawler/store-scan";
import { CatalogueTrendChart, StockoutTrendChart } from "./trend-charts";
import { markStoreAsMine, unmarkMyStore, crawlStoreNow } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { UntrackedList, type UntrackedItem } from "./untracked-list";
import { StoreBulkControls } from "./store-bulk-controls";

export const dynamic = "force-dynamic";

type Params = Promise<{ domain: string }>;

type ProductRow = {
  id: string;
  title: string | null;
  handle: string;
  image_url: string | null;
  price: string | null;
  compare_at_price: string | null;
  available: boolean | null;
};

/**
 * Per-store profile page. Renders Tier-3 intel — apps detected, theme,
 * Plus status, free shipping threshold, currency, markets count — plus
 * historical catalogue and stockout trend charts and the user's tracked
 * products on this store.
 *
 * If the store has never been scanned (just-added), runs scanStoreNow()
 * inline so the user sees a populated page on first navigation.
 */
export default async function StoreProfilePage(props: { params: Params }) {
  const { domain: rawDomain } = await props.params;
  const domain = decodeURIComponent(rawDomain).toLowerCase();

  // Confirm the user actually tracks at least one product on this store.
  const [tracked] = await db.execute<{ c: number }>(sql`
    SELECT COUNT(*)::int AS c FROM tracked_products
    WHERE store_domain = ${domain} AND active = true
  `);
  if (!tracked || tracked.c === 0) notFound();

  // Try to load existing store row; if missing, scan now (cheap one-off).
  let [store] = await db
    .select()
    .from(schema.stores)
    .where(eq(schema.stores.domain, domain))
    .limit(1);

  if (!store) {
    try {
      await scanStoreNow(domain);
      [store] = await db
        .select()
        .from(schema.stores)
        .where(eq(schema.stores.domain, domain))
        .limit(1);
    } catch {
      // If scan fails (network etc.) we still render with whatever we have.
    }
  }

  // Pull tracked products + their latest price/stock for the table.
  const products = Array.from(
    await db.execute<ProductRow>(sql`
      SELECT p.id, p.title, p.handle, p.image_url,
             p.compare_at_price,
             lp.price,
             ls.available
      FROM tracked_products p
      LEFT JOIN LATERAL (
        SELECT price FROM price_observations
        WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
      ) lp ON true
      LEFT JOIN LATERAL (
        SELECT available FROM stock_observations
        WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
      ) ls ON true
      WHERE p.store_domain = ${domain} AND p.active = true
      ORDER BY p.added_at DESC
      LIMIT 50
    `),
  );

  // Pull untracked discoveries on this store for the "not tracked" panel.
  const untrackedRows = Array.from(
    await db.execute<{
      id: string;
      handle: string;
      title: string | null;
      image_url: string | null;
      url: string;
      first_seen: string;
    }>(sql`
      SELECT id, handle, title, image_url, url, first_seen
      FROM discovered_products
      WHERE store_domain = ${domain} AND status = 'new'
      ORDER BY first_seen DESC
      LIMIT 50
    `),
  );
  const untracked: UntrackedItem[] = untrackedRows.map((r) => ({
    id: r.id,
    handle: r.handle,
    title: r.title,
    imageUrl: r.image_url,
    url: r.url,
    firstSeen: r.first_seen,
  }));

  // Pull last 30 days of snapshots for trend charts.
  const snapshots = await db
    .select({
      takenAt: schema.storeSnapshots.takenAt,
      totalProductCount: schema.storeSnapshots.totalProductCount,
      outOfStockCount: schema.storeSnapshots.outOfStockCount,
    })
    .from(schema.storeSnapshots)
    .where(eq(schema.storeSnapshots.storeDomain, domain))
    .orderBy(desc(schema.storeSnapshots.takenAt))
    .limit(30);

  const snapshotsAsc = [...snapshots].reverse().map((s) => ({
    t: new Date(s.takenAt).getTime(),
    total: s.totalProductCount,
    out: s.outOfStockCount,
  })) satisfies SnapshotPoint[];

  const apps = (store?.appsDetected ?? []) as Array<{
    slug: string;
    name: string;
    kind: string;
  }>;

  const groupedApps = groupAppsByKind(apps);
  const stockoutPct =
    store?.totalProductCount && store.outOfStockCount !== null
      ? Math.round(
          (store.outOfStockCount / Math.max(1, store.totalProductCount)) * 100,
        )
      : null;

  const symbol = currencySymbol(store?.platformCurrency ?? "GBP");

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <Link
        href="/stores"
        className="text-xs text-muted hover:text-foreground font-mono uppercase tracking-[0.18em]"
      >
        ← Stores
      </Link>

      <div className="mt-4 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-semibold tracking-tight">
              {store?.displayName ?? prettyDomain(domain)}
            </h1>
            {store?.isMyStore && (
              <span className="rounded bg-green-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-green-500 font-mono">
                My store
              </span>
            )}
            {store?.isShopifyPlus && (
              <span className="rounded bg-signal/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-signal font-mono">
                Shopify Plus
              </span>
            )}
            {store?.themeName && (
              <span className="rounded border border-default bg-elevated px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
                {store.themeName}
              </span>
            )}
          </div>
          <a
            href={`https://${domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm text-muted font-mono hover:text-foreground"
          >
            {domain} ↗
          </a>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <form action={crawlStoreNow}>
            <input type="hidden" name="domain" value={domain} />
            <SubmitButton
              className="rounded-md border border-default bg-surface px-4 py-2 text-sm hover:border-strong transition disabled:opacity-50 inline-flex items-center gap-2"
              pendingLabel="Crawling…"
              title="Re-scan store-level data and force-refresh prices on every product on this store"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12 a9 9 0 1 1 -3 -6.7" />
                <path d="M21 4 V12 H13" />
              </svg>
              Crawl now
            </SubmitButton>
          </form>

          {store?.isMyStore ? (
            <form action={unmarkMyStore}>
              <input type="hidden" name="domain" value={domain} />
              <SubmitButton
                className="rounded-md border border-default bg-surface px-4 py-2 text-sm hover:border-strong transition disabled:opacity-50"
                pendingLabel="Unmarking…"
                title="No longer treat this as your store"
              >
                Unmark as my store
              </SubmitButton>
            </form>
          ) : (
            <form action={markStoreAsMine}>
              <input type="hidden" name="domain" value={domain} />
              <SubmitButton
                className="rounded-md bg-green-500/15 border border-green-500/40 text-green-500 px-4 py-2 text-sm font-medium hover:bg-green-500/25 transition disabled:opacity-50"
                pendingLabel="Setting up…"
                title="Mark this as your own Shopify store. Auto-imports your catalogue (free, doesn't count toward plan)."
              >
                + Mark as my store
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {/* Top stats */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Tracked products"
          value={tracked.c.toString()}
        />
        <Stat
          label="Catalogue size"
          value={
            store?.totalProductCount !== undefined &&
            store?.totalProductCount !== null
              ? store.totalProductCount.toLocaleString()
              : "—"
          }
        />
        <Stat
          label="Out of stock"
          value={
            store?.outOfStockCount !== undefined &&
            store?.outOfStockCount !== null
              ? `${store.outOfStockCount}${
                  stockoutPct !== null ? ` · ${stockoutPct}%` : ""
                }`
              : "—"
          }
          highlight={
            store?.outOfStockCount && store.outOfStockCount > 0 ? "bad" : "neutral"
          }
        />
        <Stat
          label="Free shipping"
          value={
            store?.freeShippingThreshold
              ? `${freeshipSymbol(store.freeShippingCurrency)}${Number(store.freeShippingThreshold).toFixed(0)}+`
              : "—"
          }
        />
      </div>

      {/* Apps detected */}
      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted font-mono">
          Tech stack {apps.length > 0 && `(${apps.length})`}
        </h2>
        {apps.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-default px-5 py-6 text-center text-xs text-muted">
            {store
              ? "No apps detected from public scripts. The store may use minimal third-party tools."
              : "Awaiting first scan. Refresh in a few seconds."}
          </div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {Object.entries(groupedApps).map(([kind, list]) => (
              <div
                key={kind}
                className="rounded-lg border border-default bg-elevated p-4"
              >
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-mono">
                  {kindLabel(kind)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {list.map((a) => (
                    <span
                      key={a.slug}
                      className="rounded border border-default bg-surface px-2 py-1 text-xs font-mono"
                    >
                      {a.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Trend charts */}
      {snapshotsAsc.length >= 2 && (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-xs uppercase tracking-[0.18em] text-muted font-mono">
              Catalogue size · 30 days
            </h2>
            <CatalogueTrendChart data={snapshotsAsc} />
          </div>
          <div>
            <h2 className="text-xs uppercase tracking-[0.18em] text-muted font-mono">
              Out of stock · 30 days
            </h2>
            <StockoutTrendChart data={snapshotsAsc} />
          </div>
        </div>
      )}

      {/* Tracked products on this store */}
      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted font-mono">
          Tracked here ({products.length})
        </h2>
        {products.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-default px-5 py-6 text-center text-xs text-muted">
            Nothing tracked on this store.
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-default">
            {products.map((p) => {
              const onSale =
                p.compare_at_price &&
                p.price &&
                Number(p.compare_at_price) > Number(p.price);
              const discount = onSale
                ? Math.round(
                    (1 - Number(p.price) / Number(p.compare_at_price!)) * 100,
                  )
                : null;
              return (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="flex items-center gap-3 border-b border-default px-4 py-3 last:border-b-0 hover:bg-elevated transition"
                >
                  {p.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.image_url}
                      alt=""
                      className="h-9 w-9 rounded-md bg-elevated object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-md bg-elevated flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {p.title ?? p.handle}
                    </div>
                  </div>
                  {p.price && (
                    <div className="font-mono text-sm flex-shrink-0">
                      {symbol}
                      {Number(p.price).toFixed(2)}
                    </div>
                  )}
                  {discount !== null && (
                    <span className="rounded bg-signal/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-signal font-mono flex-shrink-0">
                      −{discount}%
                    </span>
                  )}
                  <div className="text-xs flex-shrink-0 w-20 text-right">
                    {p.available !== null ? (
                      <span
                        className={`inline-flex items-center gap-1.5 ${p.available ? "" : "text-signal"}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${p.available ? "bg-green-500" : "bg-signal"}`}
                        />
                        {p.available ? "In" : "Out"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Untracked discoveries on this store */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xs uppercase tracking-[0.18em] text-muted font-mono">
              Not tracked yet ({untracked.length})
            </h2>
            <span className="text-[10px] text-muted/80 font-mono uppercase tracking-[0.15em]">
              Newest first · daily catalogue scan
            </span>
          </div>
          <StoreBulkControls
            domain={domain}
            untrackedCount={untracked.length}
            autoTrackEnabled={store?.autoTrackNew ?? false}
          />
        </div>
        <UntrackedList items={untracked} />
      </section>

      {/* Footer meta */}
      <p className="mt-10 text-[11px] text-muted/80 font-mono uppercase tracking-[0.15em]">
        ·{" "}
        {store?.lastScannedAt
          ? `Last scanned ${new Date(store.lastScannedAt).toLocaleString()}`
          : "Awaiting first scan"}
      </p>
    </div>
  );
}

interface SnapshotPoint {
  t: number;
  total: number | null;
  out: number | null;
}

function Stat({
  label,
  value,
  highlight = "neutral",
}: {
  label: string;
  value: string;
  highlight?: "good" | "bad" | "neutral";
}) {
  const valueClass =
    highlight === "bad"
      ? "text-signal"
      : highlight === "good"
        ? "text-green-500"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-default bg-elevated p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
        {label}
      </div>
      <div className={`mt-1.5 text-lg font-semibold tracking-tight ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function groupAppsByKind(
  apps: Array<{ slug: string; name: string; kind: string }>,
): Record<string, Array<{ slug: string; name: string; kind: string }>> {
  const out: Record<string, Array<{ slug: string; name: string; kind: string }>> =
    {};
  for (const a of apps) {
    if (!out[a.kind]) out[a.kind] = [];
    out[a.kind].push(a);
  }
  return out;
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "email":
      return "Email & marketing";
    case "reviews":
      return "Reviews";
    case "subscriptions":
      return "Subscriptions";
    case "popups":
      return "Popups & opt-ins";
    case "fomo":
      return "Social proof / FOMO";
    case "support":
      return "Support & live chat";
    case "search":
      return "Search & merchandising";
    case "analytics":
      return "Analytics & pixels";
    case "upsells":
      return "Upsells & bundles";
    case "shipping":
      return "Shipping";
    case "tracking":
      return "Order tracking";
    default:
      return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
}

function prettyDomain(domain: string): string {
  return domain.replace(/^www\./, "").replace(/\.myshopify\.com$/, "");
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

function freeshipSymbol(c: string | null | undefined) {
  if (!c) return "";
  return currencySymbol(c);
}
