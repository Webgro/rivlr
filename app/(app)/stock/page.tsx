import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/current-user";
import { getVelocity, velocityLabel } from "@/lib/velocity";

export const dynamic = "force-dynamic";

/**
 * Stock — the competitor side of the products the owner actually sells.
 *
 * A product counts as "sold by me" when its group also holds a product from
 * one of the owner's own stores. Own stores come from
 * `user_store_prefs.is_my_store`, the per-user source of truth.
 * `stores.is_my_store` is a stale global flag and is never read.
 *
 * The own-store product is picked with a LATERAL, one per competitor row, so
 * a group holding two of the owner's products cannot duplicate a rival.
 *
 * A rival being out of stock is the whole point of the page, so those rows
 * sort to the top. Sorting happens in SQL because the list is paginated and
 * sorting one page would only sort within that page. The units-sold
 * expression mirrors lib/velocity.ts; the printed values come from
 * getVelocity, called once for the page.
 */

const PAGE_SIZE = 50;
const WINDOW_DAYS = 7;
/** Mirrors MIN_READINGS in lib/velocity.ts — keep the two in step. */
const MIN_READINGS = 3;

type SearchParams = Promise<{ page?: string }>;

type Row = {
  id: string;
  store_domain: string;
  handle: string;
  title: string | null;
  currency: string;
  latest_price: string | null;
  latest_available: boolean | null;
  latest_quantity: number | null;
  my_id: string;
  my_title: string | null;
  my_handle: string;
  my_image_url: string | null;
  total_count: number;
  out_count: number;
};

export default async function StockPage(props: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await props.searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const rows = Array.from(
    await db.execute<Row>(sql`
      WITH candidates AS (
        SELECT
          c.id, c.store_domain, c.handle, c.title, c.currency,
          c.latest_price, c.latest_available, c.latest_quantity,
          m.id AS my_id,
          m.title AS my_title,
          m.handle AS my_handle,
          m.image_url AS my_image_url
        FROM tracked_products c
        JOIN LATERAL (
          SELECT mp.id, mp.title, mp.handle, mp.image_url
          FROM tracked_products mp
          JOIN user_store_prefs usp2
            ON usp2.user_id = ${user.id}::uuid
           AND usp2.domain = mp.store_domain
           AND usp2.is_my_store = true
          WHERE mp.user_id = ${user.id}::uuid
            AND mp.active = true
            AND mp.group_id = c.group_id
          ORDER BY mp.added_at ASC
          LIMIT 1
        ) m ON true
        WHERE c.user_id = ${user.id}::uuid
          AND c.active = true
          AND c.group_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM user_store_prefs usp
            WHERE usp.user_id = ${user.id}::uuid
              AND usp.domain = c.store_domain
              AND usp.is_my_store = true
          )
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
        c.id, c.store_domain, c.handle, c.title, c.currency,
        c.latest_price, c.latest_available, c.latest_quantity,
        c.my_id, c.my_title, c.my_handle, c.my_image_url,
        (COUNT(*) OVER ())::int AS total_count,
        (SUM(CASE WHEN c.latest_available = false THEN 1 ELSE 0 END)
          OVER ())::int AS out_count
      FROM candidates c
      LEFT JOIN sold s ON s.product_id = c.id
      ORDER BY
        CASE WHEN c.latest_available = false THEN 0 ELSE 1 END ASC,
        CASE WHEN s.readings >= ${MIN_READINGS} THEN s.units_sold ELSE 0 END DESC,
        LOWER(COALESCE(c.my_title, c.my_handle)) ASC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `),
  );

  const totalCount = rows[0]?.total_count ?? 0;
  const outCount = rows[0]?.out_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // One call, for this page's products only.
  const velocity = await getVelocity(
    rows.map((r) => r.id),
    WINDOW_DAYS,
  );

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Rival stock
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted leading-relaxed">
            The things you sell, and how your rivals are doing on stock. When
            a rival runs out of something you have on the shelf, that is your
            window to hold your price or push the product.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <SummaryStat
            label="Rivals out of stock"
            value={outCount.toLocaleString()}
          />
          <SummaryStat
            label="Rival products"
            value={totalCount.toLocaleString()}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-8 overflow-hidden rounded-xl border border-default">
            <div className="grid grid-cols-[2.4fr_1.3fr_0.8fr_1fr_1.2fr] gap-3 border-b border-default bg-elevated px-5 py-3 text-[11px] font-medium text-muted">
              <div>My product</div>
              <div>Rival shop</div>
              <div className="text-right">Their price</div>
              <div className="text-right">Their stock</div>
              <div
                className="text-right cursor-help"
                title={`At least this many sold in the last ${WINDOW_DAYS} days, worked out from the shop's stock count falling. Blank when the shop does not publish a count.`}
              >
                Selling <span className="text-muted">ⓘ</span>
              </div>
            </div>
            {rows.map((r) => {
              const sold = velocityLabel(velocity.get(r.id), WINDOW_DAYS);
              const isOut = r.latest_available === false;
              return (
                <Link
                  key={r.id}
                  href={`/products/${r.id}`}
                  className={`grid grid-cols-[2.4fr_1.3fr_0.8fr_1fr_1.2fr] gap-3 px-5 py-4 border-b border-default last:border-b-0 items-center transition group ${isOut ? "bg-signal/5 hover:bg-signal/10" : "hover:bg-elevated"}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {r.my_image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={r.my_image_url}
                        alt=""
                        className="h-10 w-10 rounded-md bg-elevated object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-elevated flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium group-hover:text-signal transition">
                        {r.my_title ?? r.my_handle}
                      </div>
                      <div className="truncate text-[11px] text-muted">
                        Their version: {r.title ?? r.handle}
                      </div>
                    </div>
                  </div>

                  <div className="truncate text-[11px] text-muted font-mono">
                    {r.store_domain}
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
                href={pageHref(page - 1)}
                aria-disabled={page === 1}
                className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page === 1 ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
              >
                ← Previous
              </Link>
              <span className="text-xs text-muted font-mono">
                Page {page} of {totalPages}
              </span>
              <Link
                href={pageHref(page + 1)}
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
    return (
      <span className="font-mono text-sm font-medium text-signal">
        Out of stock
      </span>
    );
  }
  if (typeof quantity === "number") {
    return (
      <span className="font-mono text-sm text-foreground">
        {quantity.toLocaleString()} left
      </span>
    );
  }
  if (available === true) {
    return <span className="font-mono text-sm text-muted">In stock</span>;
  }
  return <span className="font-mono text-sm text-muted">—</span>;
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-default bg-elevated px-4 py-2.5 min-w-[140px]">
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <div className="mt-0.5 text-3xl font-semibold tracking-tight">
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 rounded-xl border border-dashed border-default bg-elevated px-6 py-14 text-center">
      <div className="text-sm font-medium text-foreground">
        Nothing to show yet.
      </div>
      <p className="mt-3 text-xs text-muted max-w-md mx-auto leading-relaxed">
        This page fills up once your own products are paired with the rival
        versions of the same item. Mark the shop you sell on, then work
        through the suggested matches. After that, every rival stockout on a
        product you sell turns up here.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
        <Link
          href="/products/suggestions"
          className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
        >
          Review suggested matches
        </Link>
        <Link
          href="/stores"
          className="rounded-md border border-default bg-surface px-4 py-2 text-sm hover:border-strong"
        >
          Choose my shop
        </Link>
      </div>
    </div>
  );
}

function pageHref(p: number): string {
  return p > 1 ? `/stock?page=${p}` : "/stock";
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
