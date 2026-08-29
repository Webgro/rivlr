import Link from "next/link";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

type UndercutRow = {
  id: string;
  title: string | null;
  handle: string;
  image_url: string | null;
  currency: string;
  my_price: string;
  their_price: string;
  their_store: string;
  [key: string]: unknown;
};

/**
 * "You've been undercut" strip for the dashboard. Lists the user's own
 * products where a linked competitor's latest price is below theirs,
 * worst gap first. Renders nothing when there are no undercuts (or no
 * my-store / no links yet), so it costs no attention until it matters.
 */
export async function UndercutWidget({ userId }: { userId: string }) {
  const rows = Array.from(
    await db.execute<UndercutRow>(sql`
      SELECT
        p.id, p.title, p.handle, p.image_url, p.currency,
        lp.price AS my_price,
        bc.price AS their_price,
        bc.store_domain AS their_store
      FROM tracked_products p
      JOIN user_store_prefs usp
        ON usp.user_id = ${userId}::uuid
       AND usp.domain = p.store_domain
       AND usp.is_my_store = true
      JOIN LATERAL (
        SELECT price FROM price_observations
        WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
      ) lp ON true
      JOIN LATERAL (
        SELECT c.store_domain, cp.price
        FROM tracked_products c
        JOIN LATERAL (
          SELECT price FROM price_observations
          WHERE product_id = c.id ORDER BY observed_at DESC LIMIT 1
        ) cp ON true
        WHERE c.group_id = p.group_id
          AND c.user_id = ${userId}::uuid
          AND c.id != p.id
          AND c.store_domain != p.store_domain
        ORDER BY cp.price ASC
        LIMIT 1
      ) bc ON bc.price::numeric < lp.price::numeric
      WHERE p.user_id = ${userId}::uuid
        AND p.active = true
        AND p.group_id IS NOT NULL
      ORDER BY (lp.price::numeric - bc.price::numeric) DESC
      LIMIT 5
    `),
  );

  if (rows.length === 0) return null;

  return (
    <section className="mt-6 rounded-xl border border-signal/40 bg-signal/[0.04] overflow-hidden">
      <div className="flex items-baseline justify-between px-5 py-3 border-b border-signal/20">
        <h2 className="text-base font-semibold text-signal">
          You&apos;ve been undercut
        </h2>
        <Link
          href="/my-products"
          className="text-xs text-muted hover:text-foreground"
        >
          All my products
        </Link>
      </div>
      <ul className="divide-y divide-default">
        {rows.map((r) => {
          const mine = Number(r.my_price);
          const theirs = Number(r.their_price);
          const pct = mine > 0 ? Math.round(((mine - theirs) / mine) * 100) : 0;
          const symbol = currencySymbol(r.currency);
          return (
            <li key={r.id}>
              <Link
                href={`/products/${r.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-elevated transition"
              >
                {r.image_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.image_url}
                    alt=""
                    className="h-9 w-9 rounded-md bg-elevated object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-md bg-elevated flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {r.title ?? r.handle}
                  </div>
                  <div className="truncate text-xs text-muted font-mono">
                    {r.their_store}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-mono">
                    <span className="text-muted">{symbol}{mine.toFixed(2)}</span>
                    <span className="text-muted/60 mx-1.5">vs</span>
                    <span className="text-signal font-semibold">
                      {symbol}{theirs.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-[11px] text-signal">
                    {pct}% below you
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
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
    default:
      return c + " ";
  }
}
