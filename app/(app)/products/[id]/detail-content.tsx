import Link from "next/link";
import { type ProductDetailData } from "./data";
import { PriceChart, StockChart } from "./charts";
import {
  pauseProduct,
  resumeProduct,
  deleteProduct,
  toggleStockNotify,
  togglePriceDropNotify,
  unlinkProduct,
} from "../actions";
import { TagChip } from "@/components/tag-chip";
import { LinkProductButton } from "./link-product-button";

interface DetailContentProps {
  data: ProductDetailData;
  variant: "page" | "panel";
}

export function DetailContent({ data, variant }: DetailContentProps) {
  const { product, priceObs, stockObs, recent, tagColors, linkedProducts } = data;

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

  const minPrice = priceData.length
    ? Math.min(...priceData.map((p) => p.price))
    : null;
  const maxPrice = priceData.length
    ? Math.max(...priceData.map((p) => p.price))
    : null;
  const stockOuts = stockObs.filter((o) => !o.available).length;

  let sold30d: number | null = null;
  if (hasQuantity) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentQtyObs = stockObs
      .filter(
        (o) =>
          o.quantity !== null && new Date(o.observedAt).getTime() >= cutoff,
      )
      .sort(
        (a, b) =>
          new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime(),
      );
    let total = 0;
    for (let i = 1; i < recentQtyObs.length; i++) {
      const prev = recentQtyObs[i - 1].quantity!;
      const curr = recentQtyObs[i].quantity!;
      if (prev > curr) total += prev - curr;
    }
    sold30d = total;
  }

  const symbol = currencySymbol(product.currency);
  const wrap =
    variant === "page"
      ? "mx-auto max-w-6xl px-6 py-10"
      : "px-6 py-6";
  const statsCols = hasQuantity
    ? variant === "page"
      ? "md:grid-cols-5"
      : "md:grid-cols-3"
    : variant === "page"
      ? "md:grid-cols-4"
      : "md:grid-cols-2";

  return (
    <div className={wrap}>
      {/* Product header */}
      <div className="flex items-start gap-6">
        {product.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={product.imageUrl}
            alt=""
            className="h-20 w-20 rounded-lg bg-elevated object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-20 w-20 rounded-lg bg-elevated flex-shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-muted font-mono">
            {product.storeDomain}
          </div>
          <h1
            className={`mt-1 font-semibold tracking-tight ${variant === "page" ? "text-2xl" : "text-xl"}`}
          >
            {product.title ?? product.handle}
            {!product.active && (
              <span className="ml-3 rounded bg-elevated border border-default px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted font-mono align-middle">
                paused
              </span>
            )}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-foreground underline-offset-2 hover:underline font-mono"
            >
              View on competitor's site ↗
            </a>
            {variant === "panel" && (
              <Link
                href={`/products/${product.id}`}
                className="text-xs text-muted hover:text-foreground underline-offset-2 hover:underline font-mono"
              >
                Open full page ↗
              </Link>
            )}
            {product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {product.tags.map((t) => (
                  <TagChip
                    key={t}
                    name={t}
                    color={tagColors[t] ?? "gray"}
                    href={`/dashboard?tag=${encodeURIComponent(t)}`}
                    size="md"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {product.active ? (
            <form action={pauseProduct}>
              <input type="hidden" name="id" value={product.id} />
              <button
                type="submit"
                className="rounded-md border border-default bg-elevated px-3 py-1.5 text-sm hover:border-strong"
              >
                Pause
              </button>
            </form>
          ) : (
            <form action={resumeProduct}>
              <input type="hidden" name="id" value={product.id} />
              <button
                type="submit"
                className="rounded-md border border-default bg-elevated px-3 py-1.5 text-sm hover:border-strong"
              >
                Resume
              </button>
            </form>
          )}
          <form action={deleteProduct}>
            <input type="hidden" name="id" value={product.id} />
            <button
              type="submit"
              className="rounded-md border border-signal/40 bg-signal/5 px-3 py-1.5 text-sm text-signal hover:border-signal hover:bg-signal/10"
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      {/* Notification toggles */}
      <div className="mt-6 rounded-lg border border-default bg-elevated p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted font-mono mb-3">
          Notifications
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-8">
          <NotifyToggle
            id={product.id}
            label="Stock changes"
            help="Email me when this product goes in or out of stock."
            checked={product.notifyStockChanges}
            action={toggleStockNotify}
          />
          <NotifyToggle
            id={product.id}
            label="Price drops"
            help="Email me when the price drops by any amount."
            checked={product.notifyPriceDrops}
            action={togglePriceDropNotify}
          />
        </div>
        <p className="mt-3 text-[11px] text-muted font-mono">
          Emails actually start sending in Phase 5 (Resend). Toggles persist now.
        </p>
      </div>

      {/* Stat cards */}
      <div className={`mt-6 grid grid-cols-2 gap-3 ${statsCols}`}>
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
        {hasQuantity && (
          <Stat
            label="Sold (30d)"
            value={sold30d !== null ? sold30d.toString() : "—"}
          />
        )}
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
          label="Stock-outs"
          value={stockOuts.toString()}
          highlight={stockOuts > 0 ? "bad" : "neutral"}
        />
      </div>

      {/* Linked products */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider text-muted font-mono">
            Linked products {linkedProducts.length > 0 && `(${linkedProducts.length})`}
          </h2>
          <LinkProductButton productId={product.id} />
        </div>
        {linkedProducts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-default px-5 py-6 text-center text-xs text-muted">
            Same item sold elsewhere? Link it to compare prices side by side.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-default">
            {linkedProducts.map((lp) => {
              const lpSymbol = currencySymbol(lp.currency);
              return (
                <div
                  key={lp.id}
                  className="flex items-center gap-3 border-b border-default px-4 py-3 last:border-b-0"
                >
                  <Link
                    href={`/products/${lp.id}`}
                    className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80"
                  >
                    {lp.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={lp.image_url}
                        alt=""
                        className="h-9 w-9 rounded-md bg-elevated object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-9 w-9 rounded-md bg-elevated flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {lp.title ?? lp.handle}
                      </div>
                      <div className="truncate text-xs text-muted font-mono">
                        {lp.store_domain}
                      </div>
                    </div>
                  </Link>
                  <div className="font-mono text-sm flex-shrink-0">
                    {lp.price ? `${lpSymbol}${Number(lp.price).toFixed(2)}` : "—"}
                  </div>
                  <div className="text-xs flex-shrink-0 w-24 text-right">
                    {lp.available !== null ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${lp.available ? "bg-green-500" : "bg-signal"}`}
                        />
                        {lp.available ? "In stock" : "Out"}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>
                  <form action={unlinkProduct}>
                    <input type="hidden" name="id" value={lp.id} />
                    <button
                      type="submit"
                      title="Unlink"
                      className="text-muted hover:text-signal text-xs"
                    >
                      ×
                    </button>
                  </form>
                </div>
              );
            })}
            {product.groupId && (
              <form action={unlinkProduct} className="border-t border-default px-4 py-2 text-right">
                <input type="hidden" name="id" value={product.id} />
                <button
                  type="submit"
                  className="text-xs text-muted hover:text-signal font-mono"
                >
                  Remove this product from group
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="mt-8">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted font-mono">
          Price history
        </h2>
        <PriceChart data={priceData} currencySymbol={symbol} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-xs uppercase tracking-wider text-muted font-mono">
          {hasQuantity ? "Inventory history" : "Stock availability"}
        </h2>
        <StockChart data={stockData} hasQuantity={hasQuantity} />
        {!hasQuantity && (
          <p className="mt-2 text-xs text-muted">
            This store doesn't expose inventory quantities in its public data
            — we're tracking in/out only.
          </p>
        )}
      </div>

      {/* Observations table — hidden in panel to keep it compact */}
      {variant === "page" && recent.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-xs uppercase tracking-wider text-muted font-mono">
            Recent observations
          </h2>
          <div className="overflow-hidden rounded-lg border border-default">
            <table className="w-full text-sm">
              <thead className="bg-elevated text-[11px] uppercase tracking-wider text-muted font-mono">
                <tr>
                  <th className="px-4 py-2 text-left">When</th>
                  <th className="px-4 py-2 text-left">Price</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r, i) => (
                  <tr
                    key={i}
                    className="border-t border-default hover:bg-elevated"
                  >
                    <td className="px-4 py-2 text-muted font-mono text-xs">
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
    </div>
  );
}

function NotifyToggle({
  id,
  label,
  help,
  checked,
  action,
}: {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className="flex items-start gap-3">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="value" value={(!checked).toString()} />
      <button
        type="submit"
        role="switch"
        aria-checked={checked}
        aria-label={`Toggle ${label}`}
        className={`relative mt-0.5 h-5 w-9 flex-shrink-0 rounded-full border transition ${
          checked
            ? "border-signal bg-signal"
            : "border-default bg-elevated hover:border-strong"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? "translate-x-[18px]" : "translate-x-[2px]"
          }`}
        />
      </button>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted mt-0.5">{help}</div>
      </div>
    </form>
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
        : "text-foreground";
  return (
    <div className="rounded-lg border border-default bg-elevated p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted font-mono">
        {label}
      </div>
      <div
        className={`mt-1.5 text-lg font-semibold tracking-tight ${valueClass}`}
      >
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
