import Link from "next/link";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

type StoreRow = {
  domain: string;
  display_name: string | null;
  total_product_count: number | null;
  out_of_stock_count: number | null;
  apps_count: number;
  is_shopify_plus: boolean;
  platform_currency: string | null;
  free_shipping_threshold: string | null;
  free_shipping_currency: string | null;
  last_scanned_at: string | null;
  tracked_count: number;
};

/**
 * Stores index. Lists every Shopify store with at least one tracked product,
 * with per-store intel from the daily /api/crawl/stores scan: catalogue size,
 * stockout count, app count, Plus status, free shipping threshold.
 *
 * If a store hasn't been scanned yet (newly tracked, cron hasn't run),
 * shows a placeholder row. Click through for the full profile.
 */
export default async function StoresPage() {
  const rows = await db.execute<StoreRow>(sql`
    SELECT
      tp.store_domain AS domain,
      s.display_name,
      s.total_product_count,
      s.out_of_stock_count,
      COALESCE(jsonb_array_length(s.apps_detected), 0)::int AS apps_count,
      COALESCE(s.is_shopify_plus, false) AS is_shopify_plus,
      s.platform_currency,
      s.free_shipping_threshold,
      s.free_shipping_currency,
      s.last_scanned_at,
      COUNT(tp.id)::int AS tracked_count
    FROM tracked_products tp
    LEFT JOIN stores s ON s.domain = tp.store_domain
    WHERE tp.active = true
    GROUP BY tp.store_domain, s.display_name, s.total_product_count,
             s.out_of_stock_count, s.apps_detected, s.is_shopify_plus,
             s.platform_currency, s.free_shipping_threshold,
             s.free_shipping_currency, s.last_scanned_at
    ORDER BY tracked_count DESC, tp.store_domain ASC
  `);
  const stores = Array.from(rows);

  const total = stores.length;
  const totalTracked = stores.reduce((s, r) => s + r.tracked_count, 0);
  const totalCatalogue = stores.reduce(
    (s, r) => s + (r.total_product_count ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted font-mono">
            Surveillance roster
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Stores
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted leading-relaxed">
            Every store you track, with intel pulled from public storefront
            data — apps installed, Plus status, free-shipping thresholds,
            catalogue growth and stockout trend lines.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <SummaryStat label="Stores" value={total.toString()} />
          <SummaryStat label="Tracked products" value={totalTracked.toString()} />
          <SummaryStat
            label="Catalogue (total)"
            value={totalCatalogue > 0 ? totalCatalogue.toLocaleString() : "—"}
          />
        </div>
      </div>

      {stores.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-default bg-elevated px-6 py-12 text-center text-sm text-muted">
          No tracked stores yet. Add a competitor product to start watching.
        </div>
      ) : (
        <div className="mt-10 overflow-hidden rounded-xl border border-default">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 border-b border-default bg-elevated px-5 py-3 text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
            <div>Store</div>
            <div>Tracked</div>
            <div>Catalogue</div>
            <div>Out of stock</div>
            <div>Apps</div>
            <div className="text-right">Plan / Currency</div>
          </div>
          {stores.map((s) => (
            <Link
              key={s.domain}
              href={`/stores/${encodeURIComponent(s.domain)}`}
              className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-4 border-b border-default last:border-b-0 items-center hover:bg-elevated transition group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium truncate">
                  {s.display_name ?? prettyDomain(s.domain)}
                  {s.is_shopify_plus && (
                    <span className="rounded bg-signal/15 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-signal font-mono">
                      Plus
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-muted font-mono mt-0.5">
                  {s.domain}
                </div>
                {s.last_scanned_at && (
                  <div className="text-[10px] text-muted/80 font-mono mt-1 uppercase tracking-[0.15em]">
                    Scanned {timeAgo(s.last_scanned_at)}
                  </div>
                )}
              </div>
              <div className="text-sm font-mono">{s.tracked_count}</div>
              <div className="text-sm font-mono text-muted">
                {s.total_product_count !== null
                  ? s.total_product_count.toLocaleString()
                  : "—"}
              </div>
              <div className="text-sm font-mono">
                {s.out_of_stock_count !== null ? (
                  <span
                    className={
                      s.out_of_stock_count > 0
                        ? "text-signal"
                        : "text-muted"
                    }
                  >
                    {s.out_of_stock_count}
                  </span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
              <div className="text-sm font-mono text-muted">
                {s.apps_count > 0 ? s.apps_count : "—"}
              </div>
              <div className="text-right text-xs font-mono text-muted flex items-center justify-end gap-2">
                {s.platform_currency ?? "—"}
                <span className="text-muted/60 group-hover:text-foreground transition">
                  ›
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-6 text-[11px] text-muted/80 font-mono uppercase tracking-[0.15em]">
        · Intel refreshed daily via store scan cron (05:30 UTC)
      </p>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-default bg-elevated px-4 py-2.5 min-w-[110px]">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function prettyDomain(domain: string): string {
  return domain.replace(/^www\./, "").replace(/\.myshopify\.com$/, "");
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
