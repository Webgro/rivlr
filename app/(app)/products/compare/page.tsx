import Link from "next/link";
import { db, schema } from "@/lib/db";
import { inArray, asc, eq } from "drizzle-orm";
import { CompareChart } from "./compare-chart";

export const dynamic = "force-dynamic";

const COMPARE_COLOURS = [
  "#FF3B30", // signal red
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f59e0b", // amber
];

type SearchParams = Promise<{ ids?: string }>;

export default async function ComparePage(props: {
  searchParams: SearchParams;
}) {
  const params = await props.searchParams;
  const ids = (params.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);

  if (ids.length === 0) {
    return (
      <section className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
        <p className="mt-1 text-sm text-muted">
          Select 2–5 products from the products page (tick the checkboxes,
          then use the &ldquo;Compare&rdquo; bulk action) to overlay their
          price history.
        </p>
        <div className="mt-8 rounded-lg border border-dashed border-default px-8 py-12 text-center text-sm text-muted">
          No products selected.
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

  // Load each product + its full price history.
  const products = await db
    .select()
    .from(schema.trackedProducts)
    .where(inArray(schema.trackedProducts.id, ids));

  const series = await Promise.all(
    products.map(async (p, i) => {
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

  // Currency consistency check — display a warning if products span more
  // than one currency since y-axis values aren't directly comparable.
  const currencies = Array.from(new Set(series.map((s) => s.currency)));

  return (
    <section className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Compare {products.length} product{products.length === 1 ? "" : "s"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Price history side-by-side. Charts share the same y-axis — use
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

      {currencies.length > 1 && (
        <div className="mt-6 rounded-md border border-signal/40 bg-signal/5 px-4 py-3 text-sm">
          <span className="text-signal font-medium">⚠ Mixed currencies.</span>{" "}
          <span className="text-muted-strong">
            These products use different currencies ({currencies.join(", ")}).
            The chart shows raw prices — they&apos;re not directly comparable
            without FX conversion.
          </span>
        </div>
      )}

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
