import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq, and, asc, gt, isNull, sql } from "drizzle-orm";
import { Wordmark } from "@/components/wordmark";
import { PriceChart, StockChart } from "@/app/(app)/products/[id]/charts";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shared product report · Rivlr",
  robots: { index: false, follow: false },
};

const UUID_RX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = Promise<{ token: string }>;

/**
 * Public read-only product report, reached via an unguessable share
 * link. No auth; the token is the capability. Shows the product header,
 * current price/stock, and the last 90 days of charts. Deliberately no
 * links into the app other than the Rivlr sign-up CTA — every shared
 * report doubles as a landing page.
 */
export default async function SharedProductPage(props: { params: Params }) {
  const { token } = await props.params;
  if (!UUID_RX.test(token)) notFound();

  const [link] = await db
    .select()
    .from(schema.shareLinks)
    .where(and(eq(schema.shareLinks.id, token), isNull(schema.shareLinks.revokedAt)))
    .limit(1);
  if (!link) notFound();

  const [product] = await db
    .select()
    .from(schema.trackedProducts)
    .where(eq(schema.trackedProducts.id, link.targetId))
    .limit(1);
  if (!product) notFound();

  const [priceObs, stockObs] = await Promise.all([
    db
      .select({
        observedAt: schema.priceObservations.observedAt,
        price: schema.priceObservations.price,
      })
      .from(schema.priceObservations)
      .where(
        and(
          eq(schema.priceObservations.productId, product.id),
          gt(
            schema.priceObservations.observedAt,
            sql`NOW() - INTERVAL '90 days'`,
          ),
        ),
      )
      .orderBy(asc(schema.priceObservations.observedAt)),
    db
      .select({
        observedAt: schema.stockObservations.observedAt,
        available: schema.stockObservations.available,
        quantity: schema.stockObservations.quantity,
      })
      .from(schema.stockObservations)
      .where(
        and(
          eq(schema.stockObservations.productId, product.id),
          gt(
            schema.stockObservations.observedAt,
            sql`NOW() - INTERVAL '90 days'`,
          ),
        ),
      )
      .orderBy(asc(schema.stockObservations.observedAt)),
  ]);

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
  const latestPrice = priceData[priceData.length - 1] ?? null;
  const latestStock = stockObs[stockObs.length - 1] ?? null;
  const symbol = currencySymbol(product.currency);

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-paper"
      data-theme="dark"
    >
      <header className="border-b border-neutral-800/60">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Wordmark size="lg" />
          <span className="text-xs text-neutral-500">
            Shared report · read-only
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* Product header */}
        <div className="flex items-start gap-5">
          {product.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={product.imageUrl}
              alt=""
              className="h-20 w-20 rounded-lg bg-neutral-900 object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-20 w-20 rounded-lg bg-neutral-900 flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {product.title ?? product.handle}
            </h1>
            <div className="mt-1 text-sm text-neutral-500 font-mono">
              {product.storeDomain}
            </div>
          </div>
        </div>

        {/* Current numbers */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ShareStat
            label="Current price"
            value={
              latestPrice ? `${symbol}${latestPrice.price.toFixed(2)}` : "—"
            }
          />
          <ShareStat
            label="Stock"
            value={
              latestStock === null
                ? "—"
                : latestStock.available
                  ? latestStock.quantity !== null
                    ? `${latestStock.quantity} units`
                    : "In stock"
                  : "Out of stock"
            }
            tone={
              latestStock === null ? undefined : latestStock.available ? "good" : "bad"
            }
          />
          <ShareStat
            label="History shown"
            value="Last 90 days"
          />
        </div>

        {/* Charts */}
        <section className="mt-10">
          <h2 className="text-base font-semibold mb-3">Price history</h2>
          <div className="rounded-lg border border-neutral-800 bg-[#111] p-4">
            <PriceChart data={priceData} currencySymbol={symbol} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-base font-semibold mb-3">Stock history</h2>
          <div className="rounded-lg border border-neutral-800 bg-[#111] p-4">
            <StockChart data={stockData} hasQuantity={hasQuantity} />
          </div>
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-xl border border-neutral-800 bg-[#111] px-6 py-8 text-center">
          <div className="text-lg font-semibold tracking-tight">
            Tracked with Rivlr
          </div>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400 leading-relaxed">
            Rivlr watches competitor prices and stock across any Shopify
            store and emails you when something changes. Free for up to 5
            products.
          </p>
          <Link
            href="/signup?source=share"
            className="mt-5 inline-block rounded-md bg-signal px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition"
          >
            Try Rivlr free
          </Link>
        </section>
      </main>

      <footer className="border-t border-neutral-800/60 py-6 text-center text-xs text-neutral-600">
        A Webgro product
      </footer>
    </div>
  );
}

function ShareStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-[#111] p-4">
      <div className="text-xs font-medium text-neutral-500">{label}</div>
      <div
        className={`mt-1.5 text-xl font-semibold tracking-tight ${
          tone === "good"
            ? "text-green-500"
            : tone === "bad"
              ? "text-signal"
              : ""
        }`}
      >
        {value}
      </div>
    </div>
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
