import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq, asc, desc } from "drizzle-orm";
import { PriceChart, StockChart } from "./charts";
import { pauseProduct, resumeProduct, deleteProduct } from "../actions";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function ProductDetailPage(props: { params: Params }) {
  const { id } = await props.params;

  const [product] = await db
    .select()
    .from(schema.trackedProducts)
    .where(eq(schema.trackedProducts.id, id))
    .limit(1);

  if (!product) notFound();

  const priceObs = await db
    .select({
      observedAt: schema.priceObservations.observedAt,
      price: schema.priceObservations.price,
      currency: schema.priceObservations.currency,
    })
    .from(schema.priceObservations)
    .where(eq(schema.priceObservations.productId, id))
    .orderBy(asc(schema.priceObservations.observedAt));

  const stockObs = await db
    .select({
      observedAt: schema.stockObservations.observedAt,
      available: schema.stockObservations.available,
      quantity: schema.stockObservations.quantity,
    })
    .from(schema.stockObservations)
    .where(eq(schema.stockObservations.productId, id))
    .orderBy(asc(schema.stockObservations.observedAt));

  const latestPrice = priceObs[priceObs.length - 1] ?? null;
  const latestStock = stockObs[stockObs.length - 1] ?? null;

  const priceData = priceObs.map((o) => ({
    t: new Date(o.observedAt).getTime(),
    price: Number(o.price),
  }));
  const stockData = stockObs.map((o) => ({
    t: new Date(o.observedAt).getTime(),
    available: o.available ? 1 : 0,
    quantity: o.quantity,
  }));
  const hasQuantity = stockObs.some((o) => o.quantity !== null);

  // Stats
  const minPrice = priceData.length
    ? Math.min(...priceData.map((p) => p.price))
    : null;
  const maxPrice = priceData.length
    ? Math.max(...priceData.map((p) => p.price))
    : null;
  const stockOuts = stockObs.filter((o) => !o.available).length;

  // Recent observations table.
  const recent = await db
    .select({
      observedAt: schema.priceObservations.observedAt,
      price: schema.priceObservations.price,
    })
    .from(schema.priceObservations)
    .where(eq(schema.priceObservations.productId, id))
    .orderBy(desc(schema.priceObservations.observedAt))
    .limit(20);

  const symbol = currencySymbol(product.currency);

  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="block h-6 w-6 rounded-md bg-paper relative">
              <span className="absolute left-[6px] top-[6px] h-3 w-1 bg-ink" />
              <span className="absolute right-[6px] top-[6px] h-2 w-1 bg-signal" />
            </span>
            <span className="font-semibold tracking-tight">rivlr</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-xs text-neutral-400 hover:text-paper font-mono uppercase tracking-wider"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        {/* Product header */}
        <div className="flex items-start gap-6">
          {product.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.imageUrl}
              alt=""
              className="h-24 w-24 rounded-lg bg-neutral-900 object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-24 w-24 rounded-lg bg-neutral-900 flex-shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            <div className="text-xs uppercase tracking-wider text-neutral-500 font-mono">
              {product.storeDomain}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {product.title ?? product.handle}
              {!product.active && (
                <span className="ml-3 rounded bg-neutral-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400 font-mono align-middle">
                  paused
                </span>
              )}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-neutral-400 hover:text-paper underline-offset-2 hover:underline font-mono"
              >
                View on competitor's site ↗
              </a>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {product.active ? (
              <form action={pauseProduct}>
                <input type="hidden" name="id" value={product.id} />
                <button
                  type="submit"
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm hover:border-neutral-500"
                >
                  Pause tracking
                </button>
              </form>
            ) : (
              <form action={resumeProduct}>
                <input type="hidden" name="id" value={product.id} />
                <button
                  type="submit"
                  className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm hover:border-neutral-500"
                >
                  Resume tracking
                </button>
              </form>
            )}
            <form action={deleteProduct}>
              <input type="hidden" name="id" value={product.id} />
              <button
                type="submit"
                className="rounded-md border border-red-900 bg-red-950/30 px-3 py-1.5 text-sm text-red-400 hover:border-red-700 hover:text-red-300"
              >
                Delete
              </button>
            </form>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Current price"
            value={
              latestPrice
                ? `${symbol}${Number(latestPrice.price).toFixed(2)}`
                : "—"
            }
          />
          <Stat
            label="Stock"
            value={
              latestStock
                ? latestStock.available
                  ? latestStock.quantity !== null
                    ? `${latestStock.quantity} in stock`
                    : "In stock"
                  : "Out of stock"
                : "—"
            }
            highlight={
              latestStock ? (latestStock.available ? "good" : "bad") : "neutral"
            }
          />
          <Stat
            label={`Range (${priceData.length} obs)`}
            value={
              minPrice !== null && maxPrice !== null
                ? minPrice === maxPrice
                  ? `${symbol}${minPrice.toFixed(2)}`
                  : `${symbol}${minPrice.toFixed(2)} – ${symbol}${maxPrice.toFixed(2)}`
                : "—"
            }
          />
          <Stat
            label="Stock-outs detected"
            value={stockOuts.toString()}
            highlight={stockOuts > 0 ? "bad" : "neutral"}
          />
        </div>

        {/* Charts */}
        <div className="mt-8">
          <h2 className="mb-3 text-xs uppercase tracking-wider text-neutral-500 font-mono">
            Price history
          </h2>
          <PriceChart data={priceData} currencySymbol={symbol} />
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-xs uppercase tracking-wider text-neutral-500 font-mono">
            {hasQuantity ? "Inventory history" : "Stock availability"}
          </h2>
          <StockChart data={stockData} hasQuantity={hasQuantity} />
          {!hasQuantity && (
            <p className="mt-2 text-xs text-neutral-500">
              This store doesn't expose inventory quantities in its public
              data — we're tracking in/out only. Phase later: opt-in
              cart-trick can recover actual quantity for stores that hide it.
            </p>
          )}
        </div>

        {/* Observations table */}
        {recent.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-xs uppercase tracking-wider text-neutral-500 font-mono">
              Recent observations
            </h2>
            <div className="overflow-hidden rounded-lg border border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-[11px] uppercase tracking-wider text-neutral-500 font-mono">
                  <tr>
                    <th className="px-4 py-2 text-left">When</th>
                    <th className="px-4 py-2 text-left">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr
                      key={i}
                      className="border-t border-neutral-800 hover:bg-neutral-900/50"
                    >
                      <td className="px-4 py-2 text-neutral-400 font-mono text-xs">
                        {new Date(r.observedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 font-mono">
                        {symbol}
                        {Number(r.price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = "neutral",
}: {
  label: string;
  value: string;
  highlight?: "good" | "bad" | "neutral";
}) {
  const valueClass =
    highlight === "bad"
      ? "text-signal"
      : highlight === "good"
        ? "text-green-500"
        : "text-paper";
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-mono">
        {label}
      </div>
      <div className={`mt-1.5 text-lg font-semibold tracking-tight ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function currencySymbol(code: string) {
  switch (code) {
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
      return code + " ";
  }
}
