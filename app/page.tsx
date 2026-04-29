import Link from "next/link";
import { db, schema } from "@/lib/db";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const products = await db
    .select()
    .from(schema.trackedProducts)
    .where(eq(schema.trackedProducts.active, true))
    .orderBy(desc(schema.trackedProducts.addedAt));

  if (products.length === 0) return [];

  const productIds = products.map((p) => p.id);

  const latestPrices = await db.execute<{
    product_id: string;
    price: string;
    currency: string;
    observed_at: string;
  }>(sql`
    SELECT DISTINCT ON (product_id) product_id, price, currency, observed_at
    FROM price_observations
    WHERE product_id IN (${sql.join(
      productIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
    ORDER BY product_id, observed_at DESC
  `);

  const latestStock = await db.execute<{
    product_id: string;
    available: boolean;
    observed_at: string;
  }>(sql`
    SELECT DISTINCT ON (product_id) product_id, available, observed_at
    FROM stock_observations
    WHERE product_id IN (${sql.join(
      productIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
    ORDER BY product_id, observed_at DESC
  `);

  const priceMap = new Map(latestPrices.map((r) => [r.product_id, r]));
  const stockMap = new Map(latestStock.map((r) => [r.product_id, r]));

  return products.map((p) => ({
    ...p,
    latestPrice: priceMap.get(p.id) ?? null,
    latestStock: stockMap.get(p.id) ?? null,
  }));
}

export default async function DashboardPage() {
  let rows: Awaited<ReturnType<typeof getDashboardData>> = [];
  let dbError: string | null = null;

  try {
    rows = await getDashboardData();
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="border-b border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="block h-6 w-6 rounded-md bg-paper relative">
              <span className="absolute left-[6px] top-[6px] h-3 w-1 bg-ink" />
              <span className="absolute right-[6px] top-[6px] h-2 w-1 bg-signal" />
            </span>
            <span className="font-semibold tracking-tight">rivlr</span>
            <span className="ml-3 rounded bg-neutral-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400 font-mono">
              phase 1
            </span>
          </div>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="text-xs text-neutral-400 hover:text-paper"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Tracked products
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              {dbError
                ? "Database not connected yet."
                : rows.length === 0
                  ? "Nothing tracked yet."
                  : `${rows.length} product${rows.length === 1 ? "" : "s"} · daily crawl at 04:00 GMT`}
            </p>
          </div>
          <Link
            href="/products/new"
            className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600"
          >
            + Add product
          </Link>
        </div>

        {dbError ? (
          <div className="mt-12 rounded-xl border border-dashed border-neutral-800 px-8 py-10">
            <p className="text-sm text-neutral-300">
              Could not reach the database. Make sure{" "}
              <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs font-mono">
                DATABASE_URL
              </code>{" "}
              is set in Vercel and run{" "}
              <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-xs font-mono">
                npx drizzle-kit push
              </code>{" "}
              to create tables.
            </p>
            <p className="mt-3 text-xs text-neutral-500 font-mono">{dbError}</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-neutral-800 px-8 py-16 text-center">
            <p className="text-neutral-300">No products yet.</p>
            <p className="mt-1 text-sm text-neutral-500">
              Paste a Shopify product URL to start tracking it.
            </p>
            <Link
              href="/products/new"
              className="mt-6 inline-block rounded-md bg-signal px-4 py-2 text-sm font-medium text-white"
            >
              Add your first product
            </Link>
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-xl border border-neutral-800">
            <div className="grid grid-cols-[2.4fr_1fr_1fr_1fr] gap-3 border-b border-neutral-800 bg-neutral-900 px-5 py-3 text-[11px] uppercase tracking-wider text-neutral-500 font-mono">
              <div>Product</div>
              <div>Price</div>
              <div>Stock</div>
              <div className="text-right">Last crawled</div>
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[2.4fr_1fr_1fr_1fr] items-center gap-3 border-b border-neutral-800 px-5 py-4 text-sm last:border-b-0 hover:bg-neutral-900/50"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {r.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded-md bg-neutral-800 object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-md bg-neutral-800" />
                  )}
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {r.title ?? r.handle}
                    </div>
                    <div className="truncate text-xs text-neutral-500 font-mono">
                      {r.storeDomain}
                    </div>
                  </div>
                </div>

                <div className="font-mono">
                  {r.latestPrice
                    ? `${currencySymbol(r.latestPrice.currency)}${r.latestPrice.price}`
                    : "—"}
                </div>

                <div>
                  {r.latestStock ? (
                    <span className="inline-flex items-center gap-2 text-sm">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          r.latestStock.available ? "bg-green-500" : "bg-signal"
                        }`}
                      />
                      {r.latestStock.available ? "In stock" : "Out of stock"}
                    </span>
                  ) : (
                    "—"
                  )}
                </div>

                <div className="text-right text-xs text-neutral-500 font-mono">
                  {r.lastCrawledAt
                    ? formatRelative(new Date(r.lastCrawledAt))
                    : "pending"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
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
    default:
      return code + " ";
  }
}

function formatRelative(date: Date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
