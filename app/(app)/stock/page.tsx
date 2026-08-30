import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { getVelocity, velocityLabel } from "@/lib/velocity";
import { SubmitButton } from "@/components/submit-button";
import { StockTable, type StockTableRow } from "./stock-table";
import {
  STOCK_PAGE_SIZE,
  WINDOW_DAYS,
  getStockFacets,
  getStockRows,
  stockFilterParams,
  type StockFilters,
} from "./data";

export const dynamic = "force-dynamic";

/**
 * Stock — the rival side of the products the owner actually sells.
 *
 * The page only says anything once the owner's products are paired with
 * the rival versions, so when the list is short or empty the prompt to
 * go and pair more of them is the loudest thing on the page.
 *
 * Filters, selection and the bulk bar follow the Watchlist's
 * conventions. Row data and the filter rules live in ./data so the CSV
 * export can reuse them exactly.
 */

/** Below this many rows the page is not yet doing its job. */
const THIN_LIST = 10;

type SearchParams = Promise<{
  page?: string;
  q?: string;
  out?: string;
  shop?: string;
}>;

export default async function StockPage(props: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await props.searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const filters: StockFilters = {
    q: params.q?.trim() || undefined,
    out: params.out === "1",
    shop: params.shop?.trim() || undefined,
  };
  const hasFilters = Boolean(filters.q || filters.out || filters.shop);

  const facets = await getStockFacets(user.id);
  const { rows, totalCount, outCount } = await getStockRows(
    user.id,
    filters,
    { limit: STOCK_PAGE_SIZE, offset: (page - 1) * STOCK_PAGE_SIZE },
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / STOCK_PAGE_SIZE));

  // One call, for this page's products only.
  const velocity = await getVelocity(
    rows.map((r) => r.id),
    WINDOW_DAYS,
  );

  const tableRows: StockTableRow[] = rows.map((r) => ({
    id: r.id,
    storeDomain: r.storeDomain,
    handle: r.handle,
    title: r.title,
    currency: r.currency,
    price: r.price,
    available: r.available,
    quantity: r.quantity,
    myTitle: r.myTitle,
    myHandle: r.myHandle,
    myImageUrl: r.myImageUrl,
    sold: velocityLabel(velocity.get(r.id), WINDOW_DAYS),
  }));

  const qs = stockFilterParams(filters);
  const exportHref = `/api/stock/export${qs ? `?${qs}` : ""}`;

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Rival stock</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted leading-relaxed">
            The things you sell, and how your rivals are doing on stock. When
            a rival runs out of something you have on the shelf, that is your
            window to hold your price or push the product.
          </p>
          <div className="mt-4 flex items-center gap-4 flex-wrap">
            {/* A plain link, not fetch: the browser downloads it and the
                Content-Disposition header names the file. The current
                filters ride along so the sheet matches the screen. */}
            <a
              href={exportHref}
              className="inline-flex items-center gap-2 rounded-md border border-default bg-surface px-3.5 py-2 text-sm font-medium text-foreground hover:border-strong transition"
            >
              Export to a spreadsheet
            </a>
            <span className="text-xs text-muted">
              {hasFilters
                ? `Downloads all ${totalCount.toLocaleString()} row${totalCount === 1 ? "" : "s"} matching these filters.`
                : "Your product, the rival shop, their price, their stock and how fast it is going."}
            </span>
          </div>
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

      {facets.totalCount === 0 ? (
        <EmptyState />
      ) : (
        <>
          {facets.totalCount < THIN_LIST && <MatchPrompt count={facets.totalCount} />}

          <form
            method="get"
            // Force a remount when the URL changes so the selects show the
            // live values: defaultValue only applies on first mount, and a
            // soft nav would otherwise leave stale state on screen.
            key={`${params.q ?? ""}|${params.out ?? ""}|${params.shop ?? ""}`}
            className="mt-8 rounded-lg border border-default bg-elevated p-3 space-y-3"
          >
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
                  placeholder="Search by product or shop name…"
                  className="w-full rounded-md border border-default bg-surface pl-9 pr-3 py-2 text-sm text-foreground placeholder-muted outline-none focus:border-strong"
                />
              </div>
              <SubmitButton
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition disabled:opacity-50"
                pendingLabel="Filtering…"
              >
                Apply
              </SubmitButton>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium cursor-pointer transition select-none ${
                  filters.out
                    ? "border-signal/40 bg-signal/[0.06] text-signal"
                    : "border-default bg-surface text-muted hover:border-strong hover:text-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  name="out"
                  value="1"
                  defaultChecked={filters.out}
                  className="sr-only"
                />
                <span
                  className={`h-1.5 w-1.5 rounded-full ${filters.out ? "bg-signal" : "bg-muted"}`}
                />
                Out of stock only
              </label>

              <select
                name="shop"
                defaultValue={filters.shop ?? ""}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium outline-none cursor-pointer transition focus:border-strong ${
                  filters.shop
                    ? "border-signal/40 bg-signal/[0.06] text-signal"
                    : "border-default bg-surface text-foreground hover:border-strong"
                }`}
              >
                <option value="">Any rival shop</option>
                {facets.shops.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <div className="flex-1" />
              {hasFilters && (
                <Link
                  href="/stock"
                  className="text-xs text-muted hover:text-foreground"
                >
                  Clear
                </Link>
              )}
              <span className="text-xs text-muted font-mono">
                {totalCount.toLocaleString()} of{" "}
                {facets.totalCount.toLocaleString()}
              </span>
            </div>
          </form>

          {rows.length === 0 ? (
            <div className="mt-10 rounded-xl border border-dashed border-default bg-elevated px-6 py-14 text-center">
              <div className="text-sm font-medium">
                Nothing matches those filters.
              </div>
              <p className="mt-2 text-xs text-muted">
                {filters.out
                  ? "None of your rivals is out of stock right now. That is good news for them."
                  : "Try a different search, or clear the filters."}
              </p>
              <div className="mt-5">
                <Link
                  href="/stock"
                  className="inline-block rounded-md border border-default bg-surface px-4 py-2 text-sm hover:border-strong"
                >
                  Clear filters
                </Link>
              </div>
            </div>
          ) : (
            <>
              <StockTable rows={tableRows} windowDays={WINDOW_DAYS} />

              <p className="mt-4 text-xs text-muted leading-relaxed">
                Most shops keep their stock numbers private, so the selling
                column is blank for a lot of rows. That is normal. Where a
                number does show, treat it as the least that sold, not the
                exact figure.
              </p>

              {totalPages > 1 && (
                <nav className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-default bg-elevated px-4 py-3">
                  <Link
                    href={pageHref(page - 1, qs)}
                    aria-disabled={page === 1}
                    className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page === 1 ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
                  >
                    ← Previous
                  </Link>
                  <span className="text-xs text-muted font-mono">
                    Page {page} of {totalPages}
                  </span>
                  <Link
                    href={pageHref(page + 1, qs)}
                    aria-disabled={page >= totalPages}
                    className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page >= totalPages ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
                  >
                    Next
                  </Link>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The page earns its keep in proportion to how many of the owner's
 * products have a rival paired to them, so when that number is low this
 * sits above the table rather than under it.
 */
function MatchPrompt({ count }: { count: number }) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-signal/30 bg-signal/5 px-5 py-4">
      <div className="max-w-xl">
        <div className="text-sm font-medium text-foreground">
          Only {count} rival {count === 1 ? "product" : "products"} paired so
          far.
        </div>
        <p className="mt-1 text-xs text-muted leading-relaxed">
          This page is worth far more with a few dozen. Pick the rival
          versions of what you sell and they show up here.
        </p>
      </div>
      <Link
        href="/discovery"
        className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-red-600 whitespace-nowrap"
      >
        Match more products
      </Link>
    </div>
  );
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
        versions of the same item. Mark the shop you sell on, then pick the
        rival versions of what you sell. After that, every rival stockout on
        a product you sell turns up here.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
        <Link
          href="/discovery"
          className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
        >
          Match more products
        </Link>
        <Link
          href="/products/suggestions"
          className="rounded-md border border-default bg-surface px-4 py-2 text-sm hover:border-strong"
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

function pageHref(p: number, qs: string): string {
  const sp = new URLSearchParams(qs);
  if (p > 1) sp.set("page", String(p));
  const s = sp.toString();
  return s ? `/stock?${s}` : "/stock";
}
