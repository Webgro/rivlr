import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { scanStoreNow } from "@/lib/crawler/store-scan";
import { CatalogueTrendChart, StockoutTrendChart } from "./trend-charts";
import { markStoreAsMine, unmarkMyStore, crawlStoreNow } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { UntrackedList, type UntrackedItem } from "./untracked-list";
import { StoreBulkControls } from "./store-bulk-controls";
import { requireUser } from "@/lib/auth/current-user";
import { getProductQuota } from "@/lib/plan";
import { getVelocity, velocityLabel } from "@/lib/velocity";

export const dynamic = "force-dynamic";

/** Rows per page of the not-yet-watched list. A big shop has thousands. */
const PAGE_SIZE = 50;
const WINDOW_DAYS = 7;
/** Mirrors MIN_READINGS in lib/velocity.ts - keep the two in step. */
const MIN_READINGS = 3;

type Params = Promise<{ domain: string }>;
type SearchParams = Promise<{ q?: string; page?: string }>;

type NotWatchedRow = {
  id: string;
  handle: string;
  title: string | null;
  image_url: string | null;
  url: string;
  price: string | null;
  available: boolean | null;
  /** A watched product on this shop with the same handle, whoever is
   *  watching it. Null when nobody has stock readings for it. */
  rep_id: string | null;
  total_count: number;
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
export default async function StoreProfilePage(props: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const { domain: rawDomain } = await props.params;
  const domain = decodeURIComponent(rawDomain).toLowerCase();
  const search = await props.searchParams;
  const q = (search.q ?? "").trim().toLowerCase();
  const page = Math.max(1, Number(search.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // The store belongs on this user's radar when they track at least one
  // product on it OR they explicitly added it (user_store_prefs row, e.g.
  // via /stores/new). The prefs check matters right after adding a store:
  // the catalogue import runs in the background, so for a moment there
  // are zero tracked products; 404ing here made the add-store redirect
  // land on a dead page for brand-new accounts.
  const [access] = await db.execute<{ tracked: number; has_pref: boolean }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM tracked_products
        WHERE user_id = ${user.id}::uuid
          AND store_domain = ${domain}
          AND active = true) AS tracked,
      EXISTS (SELECT 1 FROM user_store_prefs
        WHERE user_id = ${user.id}::uuid
          AND domain = ${domain}) AS has_pref
  `);
  if (!access || (access.tracked === 0 && !access.has_pref)) notFound();

  // Load global store info + this user's per-store prefs.
  let [store] = await db
    .select({
      domain: schema.stores.domain,
      displayName: schema.stores.displayName,
      themeName: schema.stores.themeName,
      isShopifyPlus: schema.stores.isShopifyPlus,
      platformCurrency: schema.stores.platformCurrency,
      marketsCount: schema.stores.marketsCount,
      totalProductCount: schema.stores.totalProductCount,
      outOfStockCount: schema.stores.outOfStockCount,
      collectionsCount: schema.stores.collectionsCount,
      blogsCount: schema.stores.blogsCount,
      appsDetected: schema.stores.appsDetected,
      freeShippingThreshold: schema.stores.freeShippingThreshold,
      freeShippingCurrency: schema.stores.freeShippingCurrency,
      lastScannedAt: schema.stores.lastScannedAt,
      // Per-user prefs: COALESCE so missing rows return false defaults.
      isMyStore: sql<boolean>`COALESCE(${schema.userStorePrefs.isMyStore}, false)`,
      autoTrackNew: sql<boolean>`COALESCE(${schema.userStorePrefs.autoTrackNew}, false)`,
    })
    .from(schema.stores)
    .leftJoin(
      schema.userStorePrefs,
      and(
        eq(schema.userStorePrefs.domain, schema.stores.domain),
        eq(schema.userStorePrefs.userId, user.id),
      ),
    )
    .where(eq(schema.stores.domain, domain))
    .limit(1);

  if (!store) {
    try {
      await scanStoreNow(domain);
      [store] = await db
        .select({
          domain: schema.stores.domain,
          displayName: schema.stores.displayName,
          themeName: schema.stores.themeName,
          isShopifyPlus: schema.stores.isShopifyPlus,
          platformCurrency: schema.stores.platformCurrency,
          marketsCount: schema.stores.marketsCount,
          totalProductCount: schema.stores.totalProductCount,
          outOfStockCount: schema.stores.outOfStockCount,
          collectionsCount: schema.stores.collectionsCount,
          blogsCount: schema.stores.blogsCount,
          appsDetected: schema.stores.appsDetected,
          freeShippingThreshold: schema.stores.freeShippingThreshold,
          freeShippingCurrency: schema.stores.freeShippingCurrency,
          lastScannedAt: schema.stores.lastScannedAt,
          isMyStore: sql<boolean>`COALESCE(${schema.userStorePrefs.isMyStore}, false)`,
          autoTrackNew: sql<boolean>`COALESCE(${schema.userStorePrefs.autoTrackNew}, false)`,
        })
        .from(schema.stores)
        .leftJoin(
          schema.userStorePrefs,
          and(
            eq(schema.userStorePrefs.domain, schema.stores.domain),
            eq(schema.userStorePrefs.userId, user.id),
          ),
        )
        .where(eq(schema.stores.domain, domain))
        .limit(1);
    } catch {
      // If scan fails we still render with whatever we have.
    }
  }

  // Products on this shop the reader is NOT watching yet.
  //
  // Ordered by units sold in SQL rather than in JS: sorting one page would
  // only sort within that page, and the whole point of the order is that
  // the busiest products are on page one. The units-sold expression
  // deliberately mirrors lib/velocity.ts (downward moves only, three
  // readings minimum) so the order matches the figures printed below.
  //
  // Stock readings hang off watched products, and by definition the reader
  // is not watching these. The readings are a fact about the SHOP, not
  // about whoever happens to be watching, so a product is matched to any
  // watched copy of itself on the same shop by handle, and the best
  // evidenced one is used. Rows the reader sees are still only ever their
  // own.
  const notWatchedRows = Array.from(
    await db.execute<NotWatchedRow>(sql`
      WITH candidates AS (
        SELECT d.id, d.handle, d.title, d.image_url, d.url,
               d.price, d.available, d.first_seen
        FROM discovered_products d
        WHERE d.user_id = ${user.id}::uuid
          AND d.store_domain = ${domain}
          AND d.status = 'new'
          ${
            q
              ? sql`AND (LOWER(COALESCE(d.title, '')) LIKE ${"%" + q + "%"}
                     OR LOWER(d.handle) LIKE ${"%" + q + "%"})`
              : sql``
          }
      ),
      watched AS (
        SELECT t.id AS product_id, t.handle
        FROM tracked_products t
        WHERE t.store_domain = ${domain}
          -- Scoped to this user on purpose. Without the filter, stock
          -- readings collected by OTHER customers watching the same
          -- shop leak into this page, so a figure appears or doesn't
          -- depending on who else happens to be a customer. The number
          -- is public shop data and identifies nobody, but pooling
          -- customers' collected data is a product decision and not one
          -- to make silently. Consequence: nobody is watching these
          -- rows by definition, so this column stays blank here, and
          -- the sales figures live on /discovery where they come from
          -- the user's own watching.
          AND t.user_id = ${user.id}::uuid
          AND t.active = true
          AND EXISTS (SELECT 1 FROM candidates c WHERE c.handle = t.handle)
      ),
      deltas AS (
        SELECT
          w.handle,
          w.product_id,
          so.quantity,
          LAG(so.quantity) OVER (
            PARTITION BY w.product_id ORDER BY so.observed_at
          ) AS prev
        FROM watched w
        JOIN stock_observations so ON so.product_id = w.product_id
        WHERE so.quantity IS NOT NULL
          AND so.observed_at > now() - MAKE_INTERVAL(days => ${WINDOW_DAYS})
      ),
      per_product AS (
        SELECT
          handle,
          product_id,
          COALESCE(SUM(GREATEST(prev - quantity, 0)), 0)::int AS units_sold,
          COUNT(*)::int AS readings
        FROM deltas
        WHERE prev IS NOT NULL
        GROUP BY handle, product_id
      ),
      best AS (
        SELECT DISTINCT ON (handle)
          handle, product_id, units_sold
        FROM per_product
        WHERE readings >= ${MIN_READINGS}
        ORDER BY handle, units_sold DESC, readings DESC, product_id
      )
      SELECT
        c.id, c.handle, c.title, c.image_url, c.url, c.price, c.available,
        b.product_id AS rep_id,
        (COUNT(*) OVER ())::int AS total_count
      FROM candidates c
      LEFT JOIN best b ON b.handle = c.handle
      ORDER BY COALESCE(b.units_sold, 0) DESC, c.first_seen DESC, c.id
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `),
  );

  const matchingCount = notWatchedRows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));

  // Unfiltered total, so the heading and the "add them all" button do not
  // change meaning while someone is searching.
  const [notWatchedTotalRow] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
    FROM discovered_products
    WHERE user_id = ${user.id}::uuid
      AND store_domain = ${domain}
      AND status = 'new'
  `);
  const notWatchedTotal = notWatchedTotalRow?.n ?? 0;

  // One velocity call for this page's rows, never one per row.
  const velocity = await getVelocity(
    notWatchedRows
      .map((r) => r.rep_id)
      .filter((id): id is string => id !== null),
    WINDOW_DAYS,
  );

  const quota = await getProductQuota(user.id);

  const untracked: UntrackedItem[] = notWatchedRows.map((r) => ({
    id: r.id,
    handle: r.handle,
    title: r.title,
    imageUrl: r.image_url,
    url: r.url,
    price: r.price,
    available: r.available,
    sold: velocityLabel(
      r.rep_id ? velocity.get(r.rep_id) : undefined,
      WINDOW_DAYS,
    ),
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
              <span className="rounded border border-default bg-elevated px-2 py-0.5 text-[11px] font-medium text-muted">
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
              pendingLabel="Checking…"
              title="Refresh this store's details and re-check prices on every product tracked here"
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
              Check now
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
                title="Mark this as your own Shopify store. Your catalogue imports automatically (free, doesn't count toward your plan)."
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
          label="Products you watch"
          value={access.tracked.toString()}
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
        <h2 className="text-sm font-semibold">
          Apps they use {apps.length > 0 && `(${apps.length})`}
        </h2>
        {apps.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-default px-5 py-6 text-center text-xs text-muted">
            {store
              ? "No apps spotted on this store. It may simply use very few."
              : "Waiting for the first check. Refresh in a few seconds."}
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
            <h2 className="text-sm font-semibold">
              Catalogue size · 30 days
            </h2>
            <CatalogueTrendChart data={snapshotsAsc} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">
              Out of stock · 30 days
            </h2>
            <StockoutTrendChart data={snapshotsAsc} />
          </div>
        </div>
      )}

      {/* Products on this shop the reader is not watching yet */}
      <section className="mt-10">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold">
              Their products you are not watching ({notWatchedTotal.toLocaleString()})
            </h2>
            <span className="text-[10px] text-muted/80 font-mono uppercase tracking-[0.15em]">
              Busiest first · updates daily
            </span>
          </div>
          <StoreBulkControls
            domain={domain}
            untrackedCount={notWatchedTotal}
            autoTrackEnabled={store?.autoTrackNew ?? false}
          />
        </div>

        {(notWatchedTotal > 0 || q) && (
          <form
            method="get"
            key={q}
            className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-default bg-elevated px-4 py-3"
          >
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search by product name…"
              className="flex-1 min-w-[200px] rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground placeholder-muted outline-none focus:border-strong"
            />
            <button
              type="submit"
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-surface"
            >
              Search
            </button>
            {q && (
              <Link
                href={`/stores/${encodeURIComponent(domain)}`}
                className="text-xs text-muted hover:text-foreground"
              >
                Clear
              </Link>
            )}
            <span className="ml-auto text-xs text-muted font-mono">
              {untracked.length > 0
                ? `Showing ${(offset + 1).toLocaleString()} to ${(
                    offset + untracked.length
                  ).toLocaleString()} of ${matchingCount.toLocaleString()}`
                : `0 of ${matchingCount.toLocaleString()}`}
            </span>
          </form>
        )}

        {untracked.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-default px-5 py-8 text-center text-xs text-muted">
            {q
              ? "Nothing on this shop matches that search."
              : "You are watching everything Rivlr has found on this shop. New ones show up here as they are added."}
          </div>
        ) : (
          <>
            <UntrackedList
              items={untracked}
              currencySymbol={symbol}
              canAdd={!quota.full}
              remaining={quota.remaining}
              limitMessage={
                quota.limit === null
                  ? ""
                  : `You are watching ${quota.current.toLocaleString()} products, the most your plan allows. Remove one, or move up a plan, to add more from this shop.`
              }
            />

            {totalPages > 1 && (
              <nav className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-default bg-elevated px-4 py-3">
                <Link
                  href={pageHref(domain, page - 1, q)}
                  aria-disabled={page === 1}
                  className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page === 1 ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
                >
                  ← Previous
                </Link>
                <span className="text-xs text-muted font-mono">
                  Page {page} of {totalPages}
                </span>
                <Link
                  href={pageHref(domain, page + 1, q)}
                  aria-disabled={page >= totalPages}
                  className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page >= totalPages ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
                >
                  Next
                </Link>
              </nav>
            )}
          </>
        )}
      </section>

      {/* Footer meta */}
      <p className="mt-10 text-[11px] text-muted/80 font-mono uppercase tracking-[0.15em]">
        ·{" "}
        {store?.lastScannedAt
          ? `Last checked ${new Date(store.lastScannedAt).toLocaleString()}`
          : "Waiting for the first check"}
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
      <div className="text-[11px] font-medium text-muted">
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

function pageHref(domain: string, page: number, q: string): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/stores/${encodeURIComponent(domain)}${qs ? `?${qs}` : ""}`;
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
