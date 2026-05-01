import Link from "next/link";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getDashboardInsights } from "@/lib/dashboard-insights";
import { InsightsRow } from "@/app/(app)/products/insights-row";
import { OnboardingChecklist } from "./onboarding-checklist";

export const dynamic = "force-dynamic";

interface ActivityItem {
  productId: string;
  title: string | null;
  handle: string;
  storeDomain: string;
  currency: string;
  kind: "stock_out" | "stock_in" | "price_drop" | "price_rise";
  observedAt: Date;
  // Additional payload depending on kind
  prevPrice?: number;
  newPrice?: number;
  delta?: number;
  pct?: number;
}

interface OpportunityItem {
  productId: string;
  title: string | null;
  handle: string;
  storeDomain: string;
  currency: string;
  oosDays: number;
  lastPrice: number | null;
}

interface MoverItem {
  productId: string;
  title: string | null;
  handle: string;
  storeDomain: string;
  currency: string;
  prevPrice: number;
  newPrice: number;
  delta: number;
  pct: number;
  direction: "drop" | "rise";
}

interface SummaryStats {
  totalActive: number;
  totalStores: number;
  currentlyOOS: number;
  totalAlerts7d: number;
}

async function getOverviewData() {
  type SummaryRow = {
    total_active: number;
    total_stores: number;
    currently_oos: number;
    total_alerts_7d: number;
  };
  const [summary] = await db.execute<SummaryRow>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM tracked_products WHERE active = true) AS total_active,
      (SELECT COUNT(DISTINCT store_domain)::int FROM tracked_products WHERE active = true) AS total_stores,
      (SELECT COUNT(*)::int FROM (
        SELECT DISTINCT ON (product_id) product_id, available
        FROM stock_observations ORDER BY product_id, observed_at DESC
      ) latest WHERE latest.available = false) AS currently_oos,
      (SELECT COUNT(*)::int FROM alert_log WHERE sent_at >= NOW() - INTERVAL '7 days') AS total_alerts_7d
  `);

  const stats: SummaryStats = {
    totalActive: summary?.total_active ?? 0,
    totalStores: summary?.total_stores ?? 0,
    currentlyOOS: summary?.currently_oos ?? 0,
    totalAlerts7d: summary?.total_alerts_7d ?? 0,
  };

  // Recent activity — combine price changes + stock changes from last 7 days.
  type ActivityRow = {
    product_id: string;
    title: string | null;
    handle: string;
    store_domain: string;
    currency: string;
    kind: "stock_out" | "stock_in" | "price_drop" | "price_rise";
    observed_at: string;
    prev_price: string | null;
    new_price: string | null;
  };
  const activityRows = await db.execute<ActivityRow>(sql`
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
      WHERE po.observed_at >= NOW() - INTERVAL '7 days'
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
      WHERE so.observed_at >= NOW() - INTERVAL '7 days'
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
    LIMIT 30
  `);

  const activity: ActivityItem[] = Array.from(activityRows).map((r) => {
    const prev = r.prev_price ? Number(r.prev_price) : undefined;
    const next = r.new_price ? Number(r.new_price) : undefined;
    const delta = prev !== undefined && next !== undefined ? next - prev : undefined;
    const pct =
      prev !== undefined && next !== undefined && prev !== 0
        ? ((next - prev) / prev) * 100
        : undefined;
    return {
      productId: r.product_id,
      title: r.title,
      handle: r.handle,
      storeDomain: r.store_domain,
      currency: r.currency,
      kind: r.kind,
      observedAt: new Date(r.observed_at),
      prevPrice: prev,
      newPrice: next,
      delta,
      pct,
    };
  });

  // Opportunities — competitors currently out of stock (longest first), with
  // their last known price as benchmark.
  type OppRow = {
    product_id: string;
    title: string | null;
    handle: string;
    store_domain: string;
    currency: string;
    oos_since: string;
    last_price: string | null;
  };
  const oppRows = await db.execute<OppRow>(sql`
    WITH oos_runs AS (
      SELECT
        product_id, observed_at, available,
        SUM(CASE WHEN available THEN 1 ELSE 0 END)
          OVER (PARTITION BY product_id ORDER BY observed_at DESC) AS run_grp
      FROM stock_observations
    ),
    oos_starts AS (
      SELECT product_id, MIN(observed_at) AS oos_since
      FROM oos_runs
      WHERE run_grp = 0 AND available = false
      GROUP BY product_id
    )
    SELECT
      p.id AS product_id, p.title, p.handle, p.store_domain, p.currency,
      o.oos_since,
      lp.price AS last_price
    FROM oos_starts o
    JOIN tracked_products p ON p.id = o.product_id AND p.active = true
    LEFT JOIN LATERAL (
      SELECT price FROM price_observations
      WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
    ) lp ON true
    ORDER BY o.oos_since ASC
    LIMIT 8
  `);

  const opportunities: OpportunityItem[] = Array.from(oppRows).map((r) => {
    const since = new Date(r.oos_since);
    return {
      productId: r.product_id,
      title: r.title,
      handle: r.handle,
      storeDomain: r.store_domain,
      currency: r.currency,
      oosDays: Math.max(
        0,
        Math.floor((Date.now() - since.getTime()) / 86_400_000),
      ),
      lastPrice: r.last_price ? Number(r.last_price) : null,
    };
  });

  // Top movers (7d) — biggest absolute price changes.
  type MoverRow = {
    product_id: string;
    title: string | null;
    handle: string;
    store_domain: string;
    currency: string;
    prev_price: string;
    new_price: string;
  };
  const moverRows = await db.execute<MoverRow>(sql`
    WITH latest_prices AS (
      SELECT DISTINCT ON (product_id)
        product_id, price, observed_at
      FROM price_observations
      ORDER BY product_id, observed_at DESC
    ),
    week_ago_prices AS (
      SELECT DISTINCT ON (product_id)
        product_id, price
      FROM price_observations
      WHERE observed_at <= NOW() - INTERVAL '6 days'
      ORDER BY product_id, observed_at DESC
    )
    SELECT
      p.id AS product_id, p.title, p.handle, p.store_domain, p.currency,
      w.price::text AS prev_price,
      l.price::text AS new_price
    FROM latest_prices l
    JOIN week_ago_prices w ON w.product_id = l.product_id
    JOIN tracked_products p ON p.id = l.product_id AND p.active = true
    WHERE l.price::numeric != w.price::numeric
    ORDER BY ABS(l.price::numeric - w.price::numeric) DESC
    LIMIT 8
  `);

  const movers: MoverItem[] = Array.from(moverRows).map((r) => {
    const prev = Number(r.prev_price);
    const next = Number(r.new_price);
    const delta = next - prev;
    return {
      productId: r.product_id,
      title: r.title,
      handle: r.handle,
      storeDomain: r.store_domain,
      currency: r.currency,
      prevPrice: prev,
      newPrice: next,
      delta,
      pct: prev !== 0 ? (delta / prev) * 100 : 0,
      direction: delta < 0 ? "drop" : "rise",
    };
  });

  return { stats, activity, opportunities, movers };
}

export default async function DashboardPage() {
  let data: Awaited<ReturnType<typeof getOverviewData>> | null = null;
  let dbError: string | null = null;

  try {
    data = await getOverviewData();
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  const insights = await getDashboardInsights().catch(() => null);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            {data
              ? `Tracking ${data.stats.totalActive} product${data.stats.totalActive === 1 ? "" : "s"} across ${data.stats.totalStores} store${data.stats.totalStores === 1 ? "" : "s"}.`
              : "Overview"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/products/new"
            className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
          >
            + Add products
          </Link>
        </div>
      </div>

      {dbError && (
        <div className="mt-6 rounded-md border border-signal/40 bg-signal/5 px-4 py-3 text-sm">
          <div className="text-signal">Database error.</div>
          <div className="mt-1 text-xs text-muted font-mono">{dbError}</div>
          <div className="mt-2 text-xs text-muted">
            If you just deployed, run <code>npm run db:push</code> locally to
            apply schema changes.
          </div>
        </div>
      )}

      {insights && insights.staleCount > 5 && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-md border border-signal/40 bg-signal/5 px-4 py-3 text-sm">
          <div>
            <span className="text-signal font-medium">
              ⚠ {insights.staleCount} products haven&apos;t been crawled in 2+ hours
            </span>
            <div className="text-xs text-muted mt-0.5">
              Crawler may be lagging or some URLs are failing. Click{" "}
              <strong>Run crawl now</strong> on the products page to drain the queue.
            </div>
          </div>
        </div>
      )}

      {insights && <InsightsRow insights={insights} />}

      {/* Step-by-step onboarding — auto-hides once all 5 steps are done. */}
      <OnboardingChecklist />

      {data && (
        <>
          {/* Top wins / opportunities */}
          {data.opportunities.length > 0 && (
            <section className="mt-8">
              <div className="flex items-end justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted font-mono">
                    Opportunities
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    Competitors currently out of stock. Your chance to capture
                    market.
                  </p>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border border-default bg-elevated">
                {data.opportunities.map((o) => (
                  <Link
                    key={o.productId}
                    href={`/products/${o.productId}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-default px-4 py-3 last:border-b-0 hover:bg-surface text-sm"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {o.title ?? o.handle}
                      </div>
                      <div className="truncate text-xs text-muted font-mono">
                        {o.storeDomain}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-signal text-xs uppercase tracking-wider">
                        Out for {o.oosDays}d
                      </div>
                      {o.lastPrice !== null && (
                        <div className="mt-0.5 text-xs text-muted font-mono">
                          last {currencySymbol(o.currency)}
                          {o.lastPrice.toFixed(2)}
                        </div>
                      )}
                    </div>
                    <span className="text-muted">→</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Two-column: Top movers + Recent activity */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {/* Top movers (7d) */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted font-mono mb-3">
                Top movers (7 days)
              </h2>
              {data.movers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-default px-4 py-6 text-center text-xs text-muted">
                  No price changes in the last 7 days. Run a few crawls to
                  populate.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-default bg-elevated">
                  {data.movers.map((m) => {
                    const symbol = currencySymbol(m.currency);
                    const colorClass =
                      m.direction === "drop"
                        ? "text-green-500"
                        : "text-signal";
                    return (
                      <Link
                        key={m.productId}
                        href={`/products/${m.productId}`}
                        className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-default px-4 py-2.5 last:border-b-0 hover:bg-surface text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {m.title ?? m.handle}
                          </div>
                          <div className="truncate text-xs text-muted font-mono">
                            {m.storeDomain}
                          </div>
                        </div>
                        <div className={`text-right font-mono ${colorClass}`}>
                          <div>
                            {m.delta > 0 ? "+" : ""}
                            {symbol}
                            {Math.abs(m.delta).toFixed(2)}
                          </div>
                          <div className="text-[11px] opacity-80">
                            {m.pct > 0 ? "+" : ""}
                            {m.pct.toFixed(1)}%
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Recent activity */}
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted font-mono mb-3">
                Recent activity
              </h2>
              {data.activity.length === 0 ? (
                <div className="rounded-lg border border-dashed border-default px-4 py-6 text-center text-xs text-muted">
                  No recent changes detected. Activity appears here as products
                  move.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-default bg-elevated">
                  {data.activity.slice(0, 12).map((a, i) => (
                    <ActivityRowItem key={i} item={a} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="mt-8 flex justify-center">
            <Link
              href="/products"
              className="text-sm text-muted hover:text-foreground font-mono uppercase tracking-wider"
            >
              All tracked products →
            </Link>
          </div>
        </>
      )}
    </section>
  );
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
      className="grid grid-cols-[16px_1fr_auto] items-center gap-3 border-b border-default px-4 py-2.5 last:border-b-0 hover:bg-surface text-sm"
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
    case "CAD":
      return "CA$";
    case "AUD":
      return "A$";
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
