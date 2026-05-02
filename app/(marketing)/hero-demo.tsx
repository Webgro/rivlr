"use client";

import Link from "next/link";
import { useState } from "react";
import { SampleUrls } from "./sample-urls";

interface PreviewSuccess {
  ok: true;
  title: string;
  storeDomain: string;
  imageUrl: string | null;
  currency: string;
  price: string;
  compareAtPrice: string | null;
  available: boolean;
  quantity: number | null;
  probedQuantity: number | null;
  probedVariantTitle: string | null;
  variantCount: number;
  // Tier 1
  vendor: string | null;
  productType: string | null;
  shopifyTags: string[];
  isBestseller: boolean;
  createdAt: string | null;
  imageCount: number | null;
  // Tier 2
  gtin: string | null;
  mpn: string | null;
  brand: string | null;
  reviewCount: number | null;
  reviewScore: number | null;
  socialProofWidget: string | null;
  // Market
  marketCountry: string;
  // Rate-limit
  usesRemaining: number;
}

/**
 * The hero's primary interaction. Paste any Shopify product URL, get a live
 * card showing current price + stock + variant count + 'Track this product'
 * CTA leading to signup. Replaces a generic 'Try for free' button with a
 * concrete demonstration on the visitor's actual competitor.
 *
 * Errors are differentiated with a `kind` from the API: 'non-shopify' and
 * 'rate-limited' both have specific friendly copy below the input.
 */
export function HeroDemo() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewSuccess | null>(null);
  const [error, setError] = useState<{ message: string; kind: string } | null>(
    null,
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({ message: data.error ?? "Something went wrong", kind: data.kind ?? "unknown" });
      } else {
        setResult(data);
      }
    } catch {
      setError({ message: "Network error. Try again.", kind: "network" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <form onSubmit={submit} className="group relative">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono pointer-events-none">
              URL ›
            </span>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-rival.com/products/handle"
              className="w-full rounded-md border border-neutral-700 bg-[#0d0d0d] pl-14 pr-4 py-4 text-base text-paper placeholder-neutral-600 outline-none focus:border-signal/60 focus:shadow-[0_0_0_4px_rgba(255,59,48,0.12)] transition font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-signal px-6 py-4 text-base font-medium text-white transition hover:bg-red-600 disabled:opacity-50 whitespace-nowrap inline-flex items-center justify-center gap-2"
          >
            {loading ? "Checking…" : "Check it →"}
          </button>
        </div>
        {!result && !error && <SampleUrls />}
      </form>

      {error && (
        <div
          className={`mt-4 rounded-md border px-4 py-3 text-sm ${
            error.kind === "non-shopify"
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-signal/40 bg-signal/5"
          }`}
        >
          <div
            className={`font-medium ${error.kind === "non-shopify" ? "text-amber-300" : "text-signal"}`}
          >
            {error.kind === "non-shopify"
              ? "Shopify only — for now"
              : error.kind === "rate-limited"
                ? "Free previews used"
                : "Couldn't load that one"}
          </div>
          <div className="mt-1 text-paper/80 text-xs leading-relaxed">
            {error.message}
          </div>
          {error.kind === "rate-limited" && (
            <Link
              href="/signup?source=rate-limited"
              className="mt-3 inline-block rounded-md bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-neutral-200"
            >
              Sign up for unlimited tracking →
            </Link>
          )}
        </div>
      )}

      {result && <ResultCard result={result} url={url} />}

      <style>{`
        @keyframes result-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ResultCard({
  result,
  url,
}: {
  result: PreviewSuccess;
  url: string;
}) {
  // Compute everything for the card up front so the JSX stays readable.
  const symbol = currencySymbol(result.currency);
  const price = Number(result.price);
  const compareAt = result.compareAtPrice ? Number(result.compareAtPrice) : null;
  const discountPct =
    compareAt && compareAt > price
      ? Math.round((1 - price / compareAt) * 100)
      : null;
  const totalQty = result.quantity ?? result.probedQuantity;
  const yearAdded = result.createdAt
    ? new Date(result.createdAt).getFullYear()
    : null;

  // Top intel chips that always render if present (visible "wow" row).
  const topIntel: Array<{ label: string; value: string; tone?: "signal" | "good" }> = [];
  if (result.brand)
    topIntel.push({ label: "Brand", value: result.brand });
  else if (result.vendor)
    topIntel.push({ label: "Vendor", value: result.vendor });
  if (result.productType)
    topIntel.push({ label: "Type", value: result.productType });
  if (result.gtin) topIntel.push({ label: "GTIN", value: result.gtin });
  if (result.mpn) topIntel.push({ label: "MPN", value: result.mpn });
  if (yearAdded)
    topIntel.push({ label: "Listed", value: yearAdded.toString() });
  if (result.imageCount && result.imageCount > 0)
    topIntel.push({ label: "Images", value: result.imageCount.toString() });
  if (result.isBestseller)
    topIntel.push({ label: "Demand", value: "Bestseller", tone: "good" });
  if (result.socialProofWidget)
    topIntel.push({ label: "FOMO", value: result.socialProofWidget });

  return (
    <div className="mt-5 animate-[result-in_0.4s_ease-out]">
      <div className="rounded-xl border border-signal/40 bg-[#0d0d0d] overflow-hidden shadow-2xl shadow-signal/10">
        {/* Live status bar */}
        <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-2 bg-[#141414]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-300 font-mono truncate">
              Live · {result.storeDomain}
            </span>
          </div>
          <span className="text-[9px] uppercase tracking-[0.2em] text-neutral-500 font-mono flex-shrink-0">
            {result.marketCountry} market
          </span>
        </div>

        {/* Header: image + title + key stat row */}
        <div className="grid grid-cols-[auto_1fr] gap-4 p-5 items-start">
          {result.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={result.imageUrl}
              alt=""
              className="h-28 w-28 rounded-md bg-neutral-900 object-cover flex-shrink-0"
            />
          ) : (
            <div className="h-28 w-28 rounded-md bg-neutral-900 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="truncate font-medium text-paper text-lg leading-tight">
              {result.title}
            </div>

            {/* Price line — primary, larger */}
            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <span className="font-mono text-2xl font-semibold text-paper">
                {symbol}
                {price.toFixed(2)}
              </span>
              {compareAt && (
                <span className="font-mono text-sm text-neutral-500 line-through">
                  {symbol}{compareAt.toFixed(2)}
                </span>
              )}
              {discountPct !== null && discountPct > 0 && (
                <span className="rounded bg-signal/15 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-signal font-mono">
                  −{discountPct}%
                </span>
              )}
            </div>

            {/* Stock + reviews mini-row */}
            <div className="mt-2 flex items-center gap-3 text-xs text-neutral-300 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${result.available ? "bg-green-400" : "bg-signal"}`}
                />
                {result.available ? (
                  totalQty !== null ? (
                    <>
                      <span className="font-mono text-paper">
                        {totalQty.toLocaleString()}
                      </span>{" "}
                      <span className="text-neutral-400">in stock</span>
                      {result.probedQuantity !== null && result.quantity === null && (
                        <span className="ml-1 rounded bg-signal/15 text-signal px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] font-mono">
                          probed
                        </span>
                      )}
                    </>
                  ) : (
                    "In stock"
                  )
                ) : (
                  <span className="text-signal">Out of stock</span>
                )}
              </span>

              {result.variantCount > 1 && (
                <>
                  <span className="text-neutral-600">·</span>
                  <span>
                    <span className="font-mono text-paper">
                      {result.variantCount}
                    </span>{" "}
                    <span className="text-neutral-400">variants</span>
                  </span>
                </>
              )}

              {result.reviewCount && result.reviewCount > 0 && (
                <>
                  <span className="text-neutral-600">·</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="font-mono text-paper">
                      {result.reviewCount.toLocaleString()}
                    </span>{" "}
                    <span className="text-neutral-400">reviews</span>
                    {result.reviewScore && (
                      <span className="text-yellow-400 ml-1">
                        {result.reviewScore.toFixed(1)}★
                      </span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top intel chips */}
        {topIntel.length > 0 && (
          <div className="px-5 pb-4 -mt-1">
            <div className="text-[9px] uppercase tracking-[0.2em] text-neutral-500 font-mono mb-2">
              Intel scraped
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
              {topIntel.map((m) => (
                <div key={m.label} className="min-w-0">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-neutral-500 font-mono">
                    {m.label}
                  </div>
                  <div
                    className={`mt-0.5 text-xs font-mono truncate ${
                      m.tone === "signal"
                        ? "text-signal"
                        : m.tone === "good"
                          ? "text-green-400"
                          : "text-paper"
                    }`}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shopify tags row (the merchant's own tags) */}
        {result.shopifyTags.length > 0 && (
          <div className="px-5 pb-4">
            <div className="text-[9px] uppercase tracking-[0.2em] text-neutral-500 font-mono mb-2">
              Their merchandising tags
            </div>
            <div className="flex flex-wrap gap-1">
              {result.shopifyTags.slice(0, 12).map((t) => (
                <span
                  key={t}
                  className="rounded border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-mono text-neutral-300"
                >
                  #{t}
                </span>
              ))}
              {result.shopifyTags.length > 12 && (
                <span className="text-[10px] text-neutral-500 font-mono px-1 py-0.5">
                  +{result.shopifyTags.length - 12} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* What we'd track over time — sets up the value of signing up */}
        <div className="px-5 pb-4">
          <div className="text-[9px] uppercase tracking-[0.2em] text-neutral-500 font-mono mb-2">
            What we&apos;d track over time
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
            <TrackChip>Price changes</TrackChip>
            <TrackChip>Stock movements</TrackChip>
            <TrackChip>Sales velocity</TrackChip>
            <TrackChip>Cross-market prices</TrackChip>
          </div>
        </div>

        {/* CTA bar */}
        <div className="border-t border-neutral-800 px-5 py-4 bg-[#141414]">
          <Link
            href={`/signup?source=hero-demo&url=${encodeURIComponent(url)}`}
            className="flex items-center justify-center gap-2 rounded-md bg-signal px-5 py-3.5 text-base font-semibold text-white hover:bg-red-600 transition"
          >
            Track this product — free
            <span aria-hidden>→</span>
          </Link>
          <div className="mt-2 text-center text-[11px] text-neutral-400 font-mono uppercase tracking-[0.15em]">
            {result.usesRemaining > 0
              ? `Or check ${result.usesRemaining} more URL${result.usesRemaining === 1 ? "" : "s"}`
              : "No card · cancel anytime"}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackChip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded border border-neutral-800 bg-neutral-900/50 px-2 py-1.5 font-mono text-neutral-300">
      <span className="h-1 w-1 rounded-full bg-signal flex-shrink-0" />
      {children}
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
