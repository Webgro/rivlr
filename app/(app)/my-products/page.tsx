import Link from "next/link";
import { db, schema, type TagColor } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";
import { SubmitButton } from "@/components/submit-button";
import { PricesTable, type PriceRow } from "./prices-table";
import { getMyShop, getPriceRows, priceFilterParams } from "./data";

export const dynamic = "force-dynamic";

/**
 * /my-products — the Prices page. The user's own catalogue, side by side
 * with what rivals charge for the same thing.
 *
 * Branched off the main watchlist because own products don't count
 * toward the plan limit and the view here is comparison-first. Rows
 * arrive on their own from the overnight catalogue import, so the page
 * never offers to delete one; the only removal on offer takes away the
 * rival listings attached to a product.
 *
 * Filters, selection and the bulk bar follow the Watchlist's
 * conventions: a GET form writing to the URL, a keyed remount so the
 * selects show the live values, and one sticky action bar.
 */

type SearchParams = Promise<{
  q?: string;
  match?: string;
  shop?: string;
}>;

export default async function MyProductsPage(props: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const params = await props.searchParams;

  const mine = await getMyShop(user.id);
  if (!mine) return <NoStoreFlagged />;

  const filters = {
    q: params.q?.trim() || undefined,
    match: params.match === "yes" || params.match === "no" ? params.match : undefined,
    shop: params.shop?.trim() || undefined,
  };
  const hasFilters = Boolean(filters.q || filters.match || filters.shop);

  const { rows, totalCount, rivalShopOptions, withRivalCount } =
    await getPriceRows(user.id, mine.domain, filters);

  // Only registered tags can be applied in bulk, same rule as the
  // Watchlist.
  const tagMeta = await db
    .select({ name: schema.tags.name, color: schema.tags.color })
    .from(schema.tags)
    .where(eq(schema.tags.userId, user.id));
  const tagColors: Record<string, TagColor> = {};
  const availableTags: Array<{ name: string; color: TagColor }> = [];
  for (const t of tagMeta) {
    const color = (t.color as TagColor) ?? "gray";
    tagColors[t.name] = color;
    availableTags.push({ name: t.name, color });
  }
  availableTags.sort((a, b) => a.name.localeCompare(b.name));

  const undercut = rows.filter(
    (r) => r.myPrice !== null && r.bestPrice !== null && r.myPrice > r.bestPrice,
  ).length;

  const tableRows: PriceRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    handle: r.handle,
    imageUrl: r.imageUrl,
    currency: r.currency,
    isFavourite: r.isFavourite,
    tags: r.tags,
    myPrice: r.myPrice,
    available: r.available,
    quantity: r.quantity,
    rivalShops: r.rivalShops,
    bestPrice: r.bestPrice,
    bestCurrency: r.bestCurrency,
    bestShop: r.bestShop,
  }));

  const qs = priceFilterParams(filters);
  const exportHref = `/api/prices/export${qs ? `?${qs}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div className="text-xs font-medium text-muted">Your catalogue</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Prices</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted leading-relaxed">
            What competitors charge for the things you sell on{" "}
            <Link
              href={`/stores/${encodeURIComponent(mine.domain)}`}
              className="text-foreground underline-offset-4 hover:underline"
            >
              {mine.displayName ?? mine.domain}
            </Link>
            . Your own products are free and never count toward your plan.
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
                ? `Downloads the ${rows.length} row${rows.length === 1 ? "" : "s"} you have on screen.`
                : "Your price, theirs, and the gap, with a column to write new prices in."}
            </span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Stat label="Products" value={totalCount.toLocaleString()} />
          <Stat
            label="With a rival"
            value={`${withRivalCount} / ${totalCount}`}
          />
          <Stat
            label="Currently undercut"
            value={undercut.toString()}
            tone={undercut > 0 ? "bad" : "neutral"}
          />
        </div>
      </div>

      {totalCount > 0 && (
        <form
          method="get"
          // Force a remount when the URL changes so the selects show the
          // live values: defaultValue only applies on first mount, and a
          // soft nav would otherwise leave stale state on screen.
          key={`${params.q ?? ""}|${params.match ?? ""}|${params.shop ?? ""}`}
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
                placeholder="Search your products by name…"
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
            <FilterSelect
              name="match"
              value={filters.match ?? ""}
              defaultLabel="All products"
              options={[
                { value: "yes", label: "Has a rival" },
                { value: "no", label: "No rival yet" },
              ]}
            />
            <FilterSelect
              name="shop"
              value={filters.shop ?? ""}
              defaultLabel="Any rival shop"
              options={rivalShopOptions.map((s) => ({ value: s, label: s }))}
            />
            <div className="flex-1" />
            {hasFilters && (
              <Link
                href="/my-products"
                className="text-xs text-muted hover:text-foreground"
              >
                Clear
              </Link>
            )}
            <span className="text-xs text-muted font-mono">
              {rows.length.toLocaleString()} shown
            </span>
          </div>
        </form>
      )}

      {totalCount === 0 ? (
        <div className="mt-12 rounded-xl border border-dashed border-default bg-elevated px-6 py-10 text-center">
          <div className="text-sm font-medium">
            No products yet on {mine.displayName ?? mine.domain}.
          </div>
          <p className="mt-2 text-xs text-muted max-w-md mx-auto">
            Your shop&apos;s catalogue imports automatically overnight. If
            you&apos;d rather not wait, run it now from the Discover page.
          </p>
          <div className="mt-5">
            <Link
              href="/discover"
              className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
            >
              Import my catalogue now
            </Link>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-default bg-elevated px-6 py-14 text-center">
          <div className="text-sm font-medium">
            Nothing matches those filters.
          </div>
          <p className="mt-2 text-xs text-muted">
            Try a different search, or clear the filters to see all{" "}
            {totalCount.toLocaleString()} products.
          </p>
          <div className="mt-5">
            <Link
              href="/my-products"
              className="inline-block rounded-md border border-default bg-surface px-4 py-2 text-sm hover:border-strong"
            >
              Clear filters
            </Link>
          </div>
        </div>
      ) : (
        <>
          {withRivalCount === 0 && (
            <MatchPrompt
              text="None of your products has a rival on it yet, so there is nothing to compare against."
            />
          )}
          <PricesTable
            rows={tableRows}
            availableTags={availableTags}
            tagColors={tagColors}
            shopFilter={filters.shop ?? ""}
          />
        </>
      )}

      <p className="mt-6 text-[11px] text-muted/80 font-mono uppercase tracking-[0.15em]">
        · Own-shop products are free and don&apos;t count toward your
        plan&apos;s limit.
      </p>
    </div>
  );
}

function MatchPrompt({ text }: { text: string }) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-signal/30 bg-signal/5 px-5 py-4">
      <p className="text-sm text-foreground max-w-xl">{text}</p>
      <Link
        href="/discovery"
        className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
      >
        Find rival products
      </Link>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const valueClass =
    tone === "bad"
      ? "text-signal"
      : tone === "good"
        ? "text-green-500"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-default bg-elevated px-4 py-2.5 min-w-[110px]">
      <div className="text-[11px] font-medium text-muted">{label}</div>
      <div
        className={`mt-0.5 text-lg font-semibold tracking-tight ${valueClass}`}
      >
        {value}
      </div>
    </div>
  );
}

function FilterSelect({
  name,
  value,
  defaultLabel,
  options,
}: {
  name: string;
  value: string;
  defaultLabel: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-medium outline-none cursor-pointer transition focus:border-strong ${
        value
          ? "border-signal/40 bg-signal/[0.06] text-signal"
          : "border-default bg-surface text-foreground hover:border-strong"
      }`}
    >
      <option value="">{defaultLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NoStoreFlagged() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 text-center">
      <div className="text-xs font-medium text-muted">Setup required</div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Tell us which shop is yours.
      </h1>
      <p className="mt-3 text-sm text-muted leading-relaxed">
        Your own products are free and don&apos;t count toward your
        plan&apos;s limit. Once you mark a shop as yours, Rivlr imports its
        catalogue here for side-by-side comparison against competitors.
      </p>
      <div className="mt-8">
        <Link
          href="/stores"
          className="rounded-md bg-signal px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600"
        >
          Choose my shop
        </Link>
      </div>
    </div>
  );
}
