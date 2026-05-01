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
import { MarketSelect } from "./market-select";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { ToggleSwitch } from "@/components/toggle-switch";
import { TagChip } from "@/components/tag-chip";
import { LinkProductButton } from "./link-product-button";
import { NotesEditor } from "./notes-editor";
import { CrawlNowButton } from "./crawl-now-button";
import { DescriptionSection } from "./description-section";

interface DetailContentProps {
  data: ProductDetailData;
  variant: "page" | "panel";
}

export function DetailContent({ data, variant }: DetailContentProps) {
  const { product, priceObs, stockObs, recent, tagColors, linkedProducts, multiMarket } = data;

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
  const discountPct =
    product.compareAtPrice && latestPrice
      ? Math.round(
          (1 - Number(latestPrice.price) / Number(product.compareAtPrice)) * 100,
        )
      : null;
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
          <div className="text-xs uppercase tracking-wider text-muted font-mono flex items-center gap-2">
            {product.storeDomain}
            <Link
              href={`/stores/${encodeURIComponent(product.storeDomain)}`}
              className="text-signal hover:text-foreground underline-offset-2 hover:underline"
            >
              View store profile →
            </Link>
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
                    href={`/products?tag=${encodeURIComponent(t)}`}
                    size="md"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <CrawlNowButton productId={product.id} />
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
          <ConfirmActionButton
            action={deleteProduct}
            hidden={[{ name: "id", value: product.id }]}
            buttonClassName="rounded-md border border-signal/40 bg-signal/5 px-3 py-1.5 text-sm text-signal hover:border-signal hover:bg-signal/10"
            buttonLabel="Delete"
            title="Delete this product?"
            description={
              <>
                Stops crawling and removes all observations, price history,
                and stock data for{" "}
                <strong className="text-foreground">
                  {product.title ?? product.handle}
                </strong>
                . This cannot be undone.
              </>
            }
            confirmLabel="Yes, delete"
            variant="danger"
          />
        </div>
      </div>

      {/* Tier 1 + 2 intel — vendor, GTIN, discount, reviews, etc. Renders only
          fields that exist; entirely hidden when nothing's known. */}
      <ProductIntelStrip product={product} />

      {/* Notification toggles + market */}
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

        <div className="mt-4 pt-4 border-t border-default">
          <div className="text-[11px] uppercase tracking-wider text-muted font-mono mb-2">
            Market
          </div>
          <MarketSelect
            productId={product.id}
            initialCountry={product.marketCountry}
            initialCurrency={product.marketCurrency}
          />
        </div>

        <p className="mt-3 text-[11px] text-muted font-mono">
          Emails actually start sending in Phase 5 (Resend). Toggles persist now.
        </p>
      </div>

      {/* Across markets — daily snapshot in 7 standard markets */}
      <AcrossMarketsPanel multiMarket={multiMarket} primaryCountry={product.marketCountry} />

      {/* Stat cards */}
      <div className={`mt-6 grid grid-cols-2 gap-3 ${statsCols}`}>
        <Stat
          label={discountPct && discountPct > 0 ? `Current price (−${discountPct}%)` : "Current price"}
          value={
            latestPrice
              ? `${symbol}${Number(latestPrice.price).toFixed(2)}`
              : "—"
          }
          highlight={discountPct && discountPct > 0 ? "good" : "neutral"}
        />
        <Stat
          label={
            latestStock?.quantitySource === "probed"
              ? "Stock · probed"
              : "Stock"
          }
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
                  <div className="text-xs flex-shrink-0 w-32 text-right">
                    {lp.available !== null ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${lp.available ? "bg-green-500" : "bg-signal"}`}
                        />
                        {lp.available
                          ? lp.quantity !== null
                            ? `${lp.quantity} in stock`
                            : "In stock"
                          : "Out"}
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

      {/* Description (collapsible — from Shopify) */}
      <DescriptionSection description={product.description} />

      {/* Notes */}
      <div className="mt-6">
        <NotesEditor productId={product.id} initial={product.notes} />
      </div>

      {/* Variants — only when there's more than one. */}
      {product.variantsSnapshot && product.variantsSnapshot.length > 1 && (
        <div className="mt-8">
          <h2 className="mb-3 text-xs uppercase tracking-wider text-muted font-mono">
            Variants ({product.variantsSnapshot.length})
          </h2>
          <div className="overflow-hidden rounded-lg border border-default">
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-default bg-elevated px-4 py-2 text-[10px] uppercase tracking-wider text-muted font-mono">
              <div>Variant</div>
              <div>Price</div>
              <div>In stock</div>
              <div className="text-right">Quantity</div>
            </div>
            {product.variantsSnapshot.map((v) => (
              <div
                key={v.id}
                className="grid grid-cols-[2fr_1fr_1fr_1fr] items-center gap-3 border-b border-default px-4 py-2.5 last:border-b-0 text-sm"
              >
                <div className="truncate">{v.title}</div>
                <div className="font-mono">
                  {symbol}
                  {v.price.toFixed(2)}
                </div>
                <div>
                  <span
                    className={`inline-flex items-center gap-1.5 ${v.available ? "text-foreground" : "text-signal"}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${v.available ? "bg-green-500" : "bg-signal"}`}
                    />
                    {v.available ? "Yes" : "No"}
                  </span>
                </div>
                <div className="text-right font-mono text-muted">
                  {v.quantity !== null ? v.quantity : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            so we're tracking in/out only.
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

function AcrossMarketsPanel({
  multiMarket,
  primaryCountry,
}: {
  multiMarket: ProductDetailData["multiMarket"];
  primaryCountry: string | null;
}) {
  // De-dupe by (currency, price). Markets that share the same currency AND
  // return the same price (common with EU markets that aren't individually
  // priced) collapse into one row showing the country list. Primary market
  // is excluded since it's already shown in the header price card.
  const populated = multiMarket.filter((m) => m.price !== null);
  if (populated.length === 0) {
    return (
      <div className="mt-6">
        <h2 className="text-xs uppercase tracking-wider text-muted font-mono">
          Other market prices
        </h2>
        <div className="mt-3 rounded-lg border border-dashed border-default px-5 py-5 text-center text-xs text-muted">
          No multi-market snapshot yet. Refreshes daily at 05:30 UTC.
        </div>
      </div>
    );
  }

  const otherMarkets = populated.filter((m) => m.country !== primaryCountry);
  if (otherMarkets.length === 0) {
    return null;
  }

  // Group by (currency + price). Map key is `${currency}|${price}`.
  const grouped = new Map<
    string,
    {
      currency: string;
      price: number;
      countries: string[];
      anyOut: boolean;
      anyIn: boolean;
    }
  >();
  for (const m of otherMarkets) {
    const key = `${m.currency}|${Number(m.price).toFixed(2)}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.countries.push(m.country);
      if (m.available === false) existing.anyOut = true;
      if (m.available === true) existing.anyIn = true;
    } else {
      grouped.set(key, {
        currency: m.currency,
        price: Number(m.price),
        countries: [m.country],
        anyOut: m.available === false,
        anyIn: m.available === true,
      });
    }
  }
  const groups = Array.from(grouped.values()).sort((a, b) => a.price - b.price);

  // Find the primary's price for delta % (same-currency comparisons only).
  const primary =
    populated.find((m) => m.country === primaryCountry) ?? populated[0];
  const primaryPrice = primary.price ? Number(primary.price) : null;
  const primaryCurrency = primary.currency;

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wider text-muted font-mono">
          Other market prices · daily snapshot
        </h2>
        <span className="text-[10px] text-muted/80 font-mono uppercase tracking-[0.15em]">
          {groups.length} unique price{groups.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-default">
        <div className="grid grid-cols-[1.6fr_1fr_0.7fr_auto] gap-3 border-b border-default bg-elevated px-4 py-2 text-[10px] uppercase tracking-wider text-muted font-mono">
          <div>Markets</div>
          <div>Price</div>
          <div>vs primary</div>
          <div className="text-right">Stock</div>
        </div>
        {groups.map((g, i) => {
          const sameCurrency =
            primaryPrice !== null && g.currency === primaryCurrency;
          const deltaPct = sameCurrency && primaryPrice! > 0
            ? Math.round(((g.price - primaryPrice!) / primaryPrice!) * 100)
            : null;
          return (
            <div
              key={i}
              className="grid grid-cols-[1.6fr_1fr_0.7fr_auto] items-center gap-3 px-4 py-2.5 border-b border-default last:border-b-0 text-sm"
            >
              <div className="flex flex-wrap gap-1">
                {g.countries.map((c) => (
                  <span
                    key={c}
                    className="rounded border border-default bg-surface px-1.5 py-0.5 text-[10px] font-mono"
                  >
                    {c}
                  </span>
                ))}
              </div>
              <div className="font-mono">
                {currencySymbol(g.currency)}
                {g.price.toFixed(2)}{" "}
                <span className="text-[10px] text-muted">
                  {g.currency}
                </span>
              </div>
              <div className="font-mono text-xs">
                {deltaPct === null ? (
                  <span className="text-muted">—</span>
                ) : deltaPct === 0 ? (
                  <span className="text-muted">±0%</span>
                ) : (
                  <span
                    className={
                      deltaPct > 0 ? "text-signal" : "text-green-500"
                    }
                  >
                    {deltaPct > 0 ? "+" : ""}
                    {deltaPct}%
                  </span>
                )}
              </div>
              <div className="text-right text-xs">
                {!g.anyIn && !g.anyOut ? (
                  <span className="text-muted">—</span>
                ) : g.anyIn && g.anyOut ? (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                    Mixed
                  </span>
                ) : g.anyIn ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    In
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-signal">
                    <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                    Out
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted/80 font-mono uppercase tracking-[0.15em]">
        · Identical prices collapsed. Δ vs primary shown only for the same
        currency. Configure scanned markets in Settings.
      </p>
    </div>
  );
}

function ProductIntelStrip({
  product,
}: {
  product: ProductDetailData["product"];
}) {
  const compareAt = product.compareAtPrice
    ? Number(product.compareAtPrice)
    : null;
  const reviewBlock =
    product.reviewCount !== null && product.reviewCount > 0;
  const meta: Array<{ label: string; value: React.ReactNode; tone?: "signal" }> =
    [];

  if (product.vendor)
    meta.push({ label: "Vendor", value: product.vendor });
  if (product.brand && product.brand !== product.vendor)
    meta.push({ label: "Brand", value: product.brand });
  if (product.productType)
    meta.push({ label: "Type", value: product.productType });
  if (product.gtin) meta.push({ label: "GTIN", value: product.gtin });
  if (product.mpn) meta.push({ label: "MPN", value: product.mpn });
  if (product.imageCount !== null && product.imageCount > 0)
    meta.push({ label: "Images", value: product.imageCount.toString() });
  if (product.shopifyCreatedAt)
    meta.push({
      label: "On store for",
      value: yearsAndMonths(product.shopifyCreatedAt),
    });
  if (compareAt !== null)
    meta.push({
      label: "Compare-at",
      value: `${currencySymbol(product.currency)}${compareAt.toFixed(2)}`,
      tone: "signal",
    });
  if (reviewBlock)
    meta.push({
      label: "Reviews",
      value: `${product.reviewCount}${
        product.reviewScore ? ` · ${Number(product.reviewScore).toFixed(1)}★` : ""
      }`,
    });
  if (product.socialProofWidget)
    meta.push({
      label: "FOMO widget",
      value: product.socialProofWidget,
    });

  // Shopify tags strip — separate row so it doesn't get crushed.
  const shopifyTags = product.shopifyTags ?? [];

  if (meta.length === 0 && shopifyTags.length === 0) return null;

  return (
    <div className="mt-6 rounded-lg border border-default bg-elevated p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted font-mono mb-3">
        Product intel
      </div>
      {meta.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {meta.map((m, i) => (
            <div key={i}>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
                {m.label}
              </div>
              <div
                className={`mt-0.5 text-sm font-mono truncate ${
                  m.tone === "signal" ? "text-signal" : "text-foreground"
                }`}
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}
      {shopifyTags.length > 0 && (
        <div className="mt-4 pt-4 border-t border-default">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-mono mb-2">
            Shopify tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shopifyTags.map((t) => (
              <span
                key={t}
                className="rounded border border-default bg-surface px-2 py-0.5 text-[11px] font-mono text-muted"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Formats a past date as a human-friendly years-and-months span.
 * E.g. 84 months → "7y", 14 months → "1y 2mo", 6 months → "6mo",
 * 5 days → "5d". Always reads naturally — no "84mo" surprise.
 */
function yearsAndMonths(d: Date | string): string {
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 0) return "future";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 31) return `${days}d`;
  const totalMonths = Math.floor(days / 30.44);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${totalMonths}mo`;
  if (months === 0) return `${years}y`;
  return `${years}y ${months}mo`;
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
      <div className="mt-0.5">
        <ToggleSwitch
          type="submit"
          checked={checked}
          size="md"
          ariaLabel={`Toggle ${label}`}
        />
      </div>
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
