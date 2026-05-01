import Link from "next/link";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

type FavouriteRow = {
  id: string;
  title: string | null;
  handle: string;
  store_domain: string;
  image_url: string | null;
  currency: string;
  latest_price: string | null;
  latest_available: boolean | null;
  is_my_store: boolean;
};

/**
 * Dashboard widget showing the user's starred products at a glance. Renders
 * up to 6, sorted by most-recently-starred (proxied via added_at because we
 * don't track favourite_at separately yet). Hidden when no favourites exist
 * — no point showing an empty card.
 */
export async function FavouritesWidget() {
  const rows = Array.from(
    await db.execute<FavouriteRow>(sql`
      SELECT p.id, p.title, p.handle, p.store_domain, p.image_url, p.currency,
        lp.price AS latest_price,
        ls.available AS latest_available,
        COALESCE(s.is_my_store, false) AS is_my_store
      FROM tracked_products p
      LEFT JOIN stores s ON s.domain = p.store_domain
      LEFT JOIN LATERAL (
        SELECT price FROM price_observations
        WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
      ) lp ON true
      LEFT JOIN LATERAL (
        SELECT available FROM stock_observations
        WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
      ) ls ON true
      WHERE p.is_favourite = true AND p.active = true
      ORDER BY p.added_at DESC
      LIMIT 6
    `),
  );

  if (rows.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted font-mono inline-flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            className="text-yellow-400"
          >
            <path d="M12 2 L14.5 8.5 L21 9.5 L16 14 L17.5 21 L12 17.5 L6.5 21 L8 14 L3 9.5 L9.5 8.5 Z" />
          </svg>
          Favourites
        </h2>
        <Link
          href="/products?fav=1"
          className="text-xs text-muted hover:text-foreground font-mono uppercase tracking-[0.15em]"
        >
          View all →
        </Link>
      </div>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/products/${r.id}`}
            className="flex items-center gap-3 rounded-lg border border-default bg-elevated px-3 py-2.5 hover:bg-surface transition group"
          >
            {r.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={r.image_url}
                alt=""
                className="h-10 w-10 rounded-md bg-surface object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-md bg-surface flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium group-hover:text-signal transition">
                {r.title ?? r.handle}
              </div>
              <div className="truncate text-[11px] text-muted font-mono">
                {r.store_domain}
                {r.is_my_store && (
                  <span className="ml-1.5 text-green-500">· yours</span>
                )}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              {r.latest_price && (
                <div className="text-sm font-mono">
                  {currencySymbol(r.currency)}
                  {Number(r.latest_price).toFixed(2)}
                </div>
              )}
              {r.latest_available !== null && (
                <div
                  className={`text-[10px] font-mono uppercase tracking-[0.15em] ${r.latest_available ? "text-muted" : "text-signal"}`}
                >
                  {r.latest_available ? "in" : "out"}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
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
