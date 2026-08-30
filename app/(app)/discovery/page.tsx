import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { getVelocity, velocityLabel } from "@/lib/velocity";

export const dynamic = "force-dynamic";

/**
 * Discovery — competitor products the shop owner does NOT sell.
 *
 * "Does not sell" means one of two things:
 *   1. The product sits in no group at all (nothing has been matched to it).
 *   2. It sits in a group, but no product from one of the owner's own
 *      stores is in that group.
 *
 * Own stores come from `user_store_prefs.is_my_store` — the per-user source
 * of truth. `stores.is_my_store` is a stale global flag and is never read.
 *
 * Ordering is done in SQL so that pagination is meaningful: sorting a single
 * page by units sold would only sort within that page. The units-sold
 * expression here deliberately mirrors lib/velocity.ts (downward moves only,
 * three deltas minimum) so the order matches what the page actually prints.
 * Display values still come from getVelocity, called once for the page.
 */

const PAGE_SIZE = 50;
const WINDOW_DAYS = 7;
/** Mirrors MIN_READINGS in lib/velocity.ts — keep the two in step. */
const MIN_READINGS = 3;

type SearchParams = Promise<{
  store?: string;
  q?: string;
  page?: string;
}>;

type Row = {
  id: string;
  store_domain: string;
  handle: string;
  title: string | null;
  image_url: string | null;
  currency: string;
  latest_price: string | null;
  latest_available: boolean | null;
  latest_quantity: number | null;
  total_count: number;
};

export default async function DiscoveryPage(props: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const params = await props.searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const q = params.q?.trim().toLowerCase() ?? "";
  const offset = (page - 1) * PAGE_SIZE;

  // Reused by both queries below. Anything on one of the owner's own
  // stores is excluded outright, and any group containing one of their
  // products means they already sell that item.
  const notSoldByMe = sql`
    p.user_id = ${user.id}::uuid
    AND p.active = true
    AND NOT EXISTS (
      SELECT 1 FROM user_store_prefs usp
      WHERE usp.user_id = ${user.id}::uuid
        AND usp.domain = p.store_domain
        AND usp.is_my_store = true
    )
    AND (
      p.group_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM tracked_products mine
        JOIN user_store_prefs usp2
          ON usp2.user_id = ${user.id}::uuid
         AND usp2.domain = mine.store_domain
         AND usp2.is_my_store = true
        WHERE mine.user_id = ${user.id}::uuid
          AND mine.group_id = p.group_id
      )
    )
  `;

  const rows = Array.from(
    await db.execute<Row>(sql`
      WITH candidates AS (
        SELECT
          p.id, p.store_domain, p.handle, p.title, p.image_url, p.currency,
          p.latest_price, p.latest_available, p.latest_quantity, p.added_at
        FROM tracked_products p
        WHERE ${notSoldByMe}
          ${params.store ? sql`AND p.store_domain = ${params.store}` : sql``}
          ${
            q
              ? sql`AND (LOWER(COALESCE(p.title, '')) LIKE ${"%" + q + "%"}
                     OR LOWER(p.handle) LIKE ${"%" + q + "%"})`
              : sql``
          }
      ),
      deltas AS (
        SELECT
          so.product_id,
          so.quantity,
          LAG(so.quantity) OVER (
            PARTITION BY so.product_id ORDER BY so.observed_at
          ) AS prev
        FROM stock_observations so
        JOIN candidates c ON c.id = so.product_id
        WHERE so.quantity IS NOT NULL
          AND so.observed_at > now() - MAKE_INTERVAL(days => ${WINDOW_DAYS})
      ),
      sold AS (
        SELECT
          product_id,
          COALESCE(SUM(GREATEST(prev - quantity, 0)), 0)::int AS units_sold,
          COUNT(*)::int AS readings
        FROM deltas
        WHERE prev IS NOT NULL
        GROUP BY product_id
      )
      SELECT
        c.id, c.store_domain, c.handle, c.title, c.image_url, c.currency,
        c.latest_price, c.latest_available, c.latest_quantity,
        (COUNT(*) OVER ())::int AS total_count
      FROM candidates c
      LEFT JOIN sold s ON s.product_id = c.id
      ORDER BY
        CASE WHEN s.readings >= ${MIN_READINGS} THEN s.units_sold ELSE 0 END DESC,
        (s.product_id IS NOT NULL OR c.latest_quantity IS NOT NULL) DESC,
        c.added_at DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `),
  );

  const totalCount = rows[0]?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // One call, for this page's products only.
  const velocity = await getVelocity(
    rows.map((r) => r.id),
    WINDOW_DAYS,
  );

  // Store list for the filter. Deliberately not narrowed by the search box,
  // so the dropdown does not shrink as you type.
  const storeRows = Array.from(
    await db.execute<{ store_domain: string; n: number }>(sql`
      SELECT p.store_domain, COUNT(*)::int AS n
      FROM tracked_products p
      WHERE ${notSoldByMe}
      GROUP BY p.store_domain
      ORDER BY n DESC, p.store_domain ASC
    `),
  );

  const filtered = Boolean(params.store || q);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Products you don&apos;t sell
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted leading-relaxed">
            Everything your rivals stock that you don&apos;t, with the items
            shifting the most units first. A good place to look for the next
            thing to put on your shelves.
          </p>
        </div>
        <div className="rounded-lg border border-default bg-elevated px-4 py-2.5 min-w-[140px]">
          <div className="text-[11px] font-medium text-muted">
            {filtered ? "Matching" : "Products"}
          </div>
          <div className="mt-0.5 text-3xl font-semibold tracking-tight">
            {totalCount.toLocaleString()}
          </div>
        </div>
      </div>

      {storeRows.length > 0 || filtered ? (
        <form
          method="get"
          className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-default bg-elevated px-4 py-3"
          key={`${params.store ?? ""}|${q}`}
        >
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by product name…"
            className="flex-1 min-w-[200px] rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground placeholder-muted outline-none focus:border-strong"
          />
          <select
            name="store"
            defaultValue={params.store ?? ""}
            className="rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-strong"
          >
            <option value="">All shops</option>
            {storeRows.map((s) => (
              <option key={s.store_domain} value={s.store_domain}>
                {s.store_domain} ({s.n})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-surface"
          >
            Apply
          </button>
          {filtered && (
            <Link
              href="/discovery"
              className="text-xs text-muted hover:text-foreground"
            >
              Clear
            </Link>
          )}
          <span className="ml-auto text-xs text-muted font-mono">
            {rows.length > 0
              ? `Showing ${(offset + 1).toLocaleString()} to ${(
                  offset + rows.length
                ).toLocaleString()} of ${totalCount.toLocaleString()}`
              : `0 of ${totalCount.toLocaleString()}`}
          </span>
        </form>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState filtered={filtered} store={params.store} />
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-xl border border-default">
            <div className="grid grid-cols-[2.6fr_0.9fr_1fr_1.2fr] gap-3 border-b border-default bg-elevated px-5 py-3 text-[11px] font-medium text-muted">
              <div>Product</div>
              <div className="text-right">Price</div>
              <div className="text-right">Stock</div>
              <div
                className="text-right cursor-help"
                title={`At least this many sold in the last ${WINDOW_DAYS} days, worked out from the shop's stock count falling. Blank when the shop does not publish a count.`}
              >
                Selling <span className="text-muted">ⓘ</span>
              </div>
            </div>
            {rows.map((r) => {
              const sold = velocityLabel(velocity.get(r.id), WINDOW_DAYS);
              return (
                <Link
                  key={r.id}
                  href={`/products/${r.id}`}
                  className="grid grid-cols-[2.6fr_0.9fr_1fr_1.2fr] gap-3 px-5 py-4 border-b border-default last:border-b-0 items-center hover:bg-elevated transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {r.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={r.image_url}
                        alt=""
                        className="h-10 w-10 rounded-md bg-elevated object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-elevated flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium group-hover:text-signal transition">
                        {r.title ?? r.handle}
                      </div>
                      <div className="truncate text-[11px] text-muted font-mono">
                        {r.store_domain}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono text-sm">
                    {r.latest_price
                      ? `${currencySymbol(r.currency)}${Number(
                          r.latest_price,
                        ).toFixed(2)}`
                      : "—"}
                  </div>

                  <div className="text-right text-sm">
                    <StockCell
                      available={r.latest_available}
                      quantity={r.latest_quantity}
                    />
                  </div>

                  <div className="text-right font-mono text-sm">
                    {sold ? (
                      <span className="text-foreground">{sold}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="mt-4 text-xs text-muted leading-relaxed">
            Most shops keep their stock numbers private, so the selling column
            is blank for a lot of rows. That is normal. Where a number does
            show, treat it as the least that sold, not the exact figure.
          </p>

          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-default bg-elevated px-4 py-3">
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
  );
}

function StockCell({
  available,
  quantity,
}: {
  available: boolean | null;
  quantity: number | null;
}) {
  if (available === false) {
    return <span className="font-mono text-signal">Out of stock</span>;
  }
  if (typeof quantity === "number") {
    return (
      <span className="font-mono text-foreground">
        {quantity.toLocaleString()} left
      </span>
    );
  }
  if (available === true) {
    return <span className="font-mono text-muted">In stock</span>;
  }
  return <span className="font-mono text-muted">—</span>;
}

function EmptyState({
  filtered,
  store,
}: {
  filtered: boolean;
  store?: string;
}) {
  return (
    <div className="mt-12 rounded-xl border border-dashed border-default bg-elevated px-6 py-14 text-center">
      <div className="text-sm font-medium text-foreground">
        {filtered ? "Nothing matches that." : "Nothing to show yet."}
      </div>
      <p className="mt-3 text-xs text-muted max-w-md mx-auto leading-relaxed">
        {filtered ? (
          <>
            No products from {store ? <span className="font-mono">{store}</span> : "that search"}{" "}
            are missing from your range. Try a wider search, or clear the
            filters.
          </>
        ) : (
          <>
            This list fills up as Rivlr reads through the catalogues of the
            shops you watch. That happens once a day, so a new shop takes a
            little while to show up here. Add a rival shop to get started.
          </>
        )}
      </p>
      {!filtered && (
        <div className="mt-6">
          <Link
            href="/stores"
            className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
          >
            Add a shop to watch
          </Link>
        </div>
      )}
    </div>
  );
}

function pageHref(p: number, params: { store?: string; q?: string }): string {
  const sp = new URLSearchParams();
  if (params.store) sp.set("store", params.store);
  if (params.q) sp.set("q", params.q);
  if (p > 1) sp.set("page", String(p));
  const qs = sp.toString();
  return `/discovery${qs ? "?" + qs : ""}`;
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
