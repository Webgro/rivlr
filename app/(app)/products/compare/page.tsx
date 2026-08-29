import Link from "next/link";
import { db, schema } from "@/lib/db";
import { inArray, asc, eq, and } from "drizzle-orm";
import { CompareChart } from "./compare-chart";
import { requireUser } from "@/lib/auth/current-user";
import { getPlanFeatures, suggestNextPlan } from "@/lib/plan";

export const dynamic = "force-dynamic";

const COMPARE_COLOURS = [
  "#FF3B30", // signal red
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f59e0b", // amber
];

const UUID_RX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SearchParams = Promise<{ ids?: string }>;

export default async function ComparePage(props: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const params = await props.searchParams;

  // Plan gate. Compare is a Growth+ feature — it's the headline reason
  // to upgrade off Starter. Show a paywall card instead of the chart.
  const { plan, features } = await getPlanFeatures();
  if (!features.compare) {
    return <ComparePaywall plan={plan} />;
  }

  // Parse + validate IDs strictly. Anything that's not a UUID is dropped —
  // an invalid UUID in inArray would crash the whole query at Postgres level.
  const allIds = (params.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ids = allIds.filter((s) => UUID_RX.test(s)).slice(0, 5);
  const droppedInvalid = allIds.length - ids.length;

  if (ids.length === 0) {
    return <EmptyState droppedInvalid={droppedInvalid} />;
  }

  // Defensive load — if the query fails, show a clear error UI instead of
  // throwing a Vercel runtime error.
  let products: Awaited<
    ReturnType<typeof db.select.prototype.from>
  > = [];
  let series: Array<{
    id: string;
    title: string;
    storeDomain: string;
    currency: string;
    colour: string;
    data: { t: number; price: number }[];
  }> = [];
  let loadError: string | null = null;

  try {
    products = (await db
      .select()
      .from(schema.trackedProducts)
      .where(
        and(
          inArray(schema.trackedProducts.id, ids),
          eq(schema.trackedProducts.userId, user.id),
        ),
      )) as never;

    series = await Promise.all(
      (products as Array<{
        id: string;
        title: string | null;
        handle: string;
        storeDomain: string;
        currency: string;
      }>).map(async (p, i) => {
        const obs = await db
          .select({
            observedAt: schema.priceObservations.observedAt,
            price: schema.priceObservations.price,
          })
          .from(schema.priceObservations)
          .where(eq(schema.priceObservations.productId, p.id))
          .orderBy(asc(schema.priceObservations.observedAt));
        return {
          id: p.id,
          title: p.title ?? p.handle,
          storeDomain: p.storeDomain,
          currency: p.currency,
          colour: COMPARE_COLOURS[i % COMPARE_COLOURS.length],
          data: obs.map((o) => ({
            t: new Date(o.observedAt).getTime(),
            price: Number(o.price),
          })),
        };
      }),
    );
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }

  if (loadError) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Compare</h1>
        <div className="mt-6 rounded-md border border-signal/40 bg-signal/5 px-4 py-4 text-sm">
          <div className="text-signal font-medium">Couldn&apos;t load this comparison.</div>
          <p className="mt-2 text-muted">
            One or more of the selected products could not be loaded. Try
            selecting a different set on the products page.
          </p>
          <p className="mt-3 text-xs text-muted font-mono">{loadError}</p>
        </div>
        <div className="mt-6">
          <Link
            href="/products"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface"
          >
            ← Back to products
          </Link>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-tight">Compare</h1>
        <div className="mt-6 rounded-lg border border-dashed border-default px-8 py-12 text-center text-sm text-muted">
          None of the selected products were found.
          <div className="mt-4">
            <Link
              href="/products"
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface"
            >
              ← Back to products
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const currencies = Array.from(new Set(series.map((s) => s.currency)));
  const productsWithObs = series.filter((s) => s.data.length > 0);

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Compare {products.length} product{products.length === 1 ? "" : "s"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Price history side-by-side. Charts share the same y-axis. Use
            the legend to spot which competitor is more aggressive.
          </p>
        </div>
        <Link
          href="/products"
          className="text-sm text-muted hover:text-foreground font-mono"
        >
          ← Back to products
        </Link>
      </div>

      {droppedInvalid > 0 && (
        <div className="mt-6 rounded-md border border-default bg-elevated px-4 py-3 text-xs text-muted font-mono">
          {droppedInvalid} invalid product{droppedInvalid === 1 ? "" : "s"} ignored.
        </div>
      )}

      {currencies.length > 1 && (
        <div className="mt-6 rounded-md border border-signal/40 bg-signal/5 px-4 py-3 text-sm">
          <span className="text-signal font-medium">⚠ Mixed currencies.</span>{" "}
          <span className="text-muted-strong">
            These products use different currencies ({currencies.join(", ")}).
            The chart shows raw prices. They&apos;re not directly comparable
            without FX conversion.
          </span>
        </div>
      )}

      {productsWithObs.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-default px-8 py-12 text-center text-sm text-muted">
          None of the selected products have any price history yet. Wait for
          the first crawl to populate, then try again.
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-default bg-elevated p-4">
          <CompareChart
            series={series.map((s) => ({
              id: s.id,
              title: s.title,
              colour: s.colour,
              data: s.data,
            }))}
            currencySymbol={
              currencies.length === 1 ? currencySymbol(currencies[0]) : ""
            }
          />
        </div>
      )}

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {series.map((s) => {
          const latest = s.data[s.data.length - 1];
          const earliest = s.data[0];
          const symbol = currencySymbol(s.currency);
          const delta =
            latest && earliest ? latest.price - earliest.price : null;
          return (
            <Link
              key={s.id}
              href={`/products/${s.id}`}
              className="flex items-center gap-3 rounded-lg border border-default bg-elevated px-4 py-3 hover:border-strong"
            >
              <span
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: s.colour }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.title}</div>
                <div className="truncate text-xs text-muted font-mono">
                  {s.storeDomain}
                </div>
              </div>
              <div className="text-right font-mono text-sm flex-shrink-0">
                <div>
                  {latest ? `${symbol}${latest.price.toFixed(2)}` : "—"}
                </div>
                {delta !== null && delta !== 0 && (
                  <div
                    className={`text-xs ${delta < 0 ? "text-green-500" : "text-signal"}`}
                  >
                    {delta > 0 ? "+" : ""}
                    {symbol}
                    {delta.toFixed(2)}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ComparePaywall({ plan }: { plan: Parameters<typeof suggestNextPlan>[0] }) {
  const next = suggestNextPlan(plan);
  const upgradeHref = next ? `/billing?upgrade=${next}` : "/billing";
  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Compare</h1>
      <p className="mt-1 text-sm text-muted">
        Overlay price history across multiple products on a single chart,
        spot competitor pricing patterns at a glance.
      </p>

      <div className="mt-8 rounded-xl border border-signal/40 bg-signal/[0.03] p-6">
        <div className="text-xs font-semibold text-signal">
          Growth feature
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          Compare unlocks on Growth
        </h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          The side-by-side price chart is a Growth-tier feature. Upgrade to
          plot up to 5 products on one timeline, with currency-normalised
          prices and stockout markers per series.
        </p>

        <ul className="mt-5 space-y-1.5 text-sm text-muted">
          <li className="flex gap-2">
            <span className="text-signal">✓</span>
            <span>Up to 5 products on a single chart</span>
          </li>
          <li className="flex gap-2">
            <span className="text-signal">✓</span>
            <span>Stockout markers per series</span>
          </li>
          <li className="flex gap-2">
            <span className="text-signal">✓</span>
            <span>Currency-normalised price comparison</span>
          </li>
        </ul>

        <div className="mt-6 flex items-center gap-3 flex-wrap">
          <Link
            href={upgradeHref}
            className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition"
          >
            Upgrade{next ? ` to ${next.charAt(0).toUpperCase() + next.slice(1)}` : ""}
          </Link>
          <Link
            href="/products"
            className="text-sm text-muted hover:text-foreground transition"
          >
            ← Back to products
          </Link>
        </div>
      </div>
    </section>
  );
}

function EmptyState({ droppedInvalid }: { droppedInvalid: number }) {
  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Compare</h1>
      <p className="mt-1 text-sm text-muted">
        Select 2–5 products from the products page (tick the checkboxes,
        then use the &ldquo;Compare&rdquo; bulk action) to overlay their
        price history.
      </p>
      <div className="mt-8 rounded-lg border border-dashed border-default px-8 py-12 text-center text-sm text-muted">
        {droppedInvalid > 0
          ? `${droppedInvalid} invalid product ID${droppedInvalid === 1 ? "" : "s"} in the URL. Pick products from the list instead.`
          : "No products selected."}
        <div className="mt-4">
          <Link
            href="/products"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface"
          >
            ← Back to products
          </Link>
        </div>
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
    default:
      return c + " ";
  }
}
