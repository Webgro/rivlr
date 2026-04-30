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
  available: boolean;
  quantity: number | null;
  variantCount: number;
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

      {result && (
        <div className="mt-5 animate-[result-in_0.4s_ease-out]">
          <div className="rounded-xl border border-signal/40 bg-[#0d0d0d] overflow-hidden shadow-2xl shadow-signal/10">
            <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2 bg-[#141414]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-300 font-mono">
                Live · {result.storeDomain}
              </span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-4 p-5 items-center">
              {result.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={result.imageUrl}
                  alt=""
                  className="h-24 w-24 rounded-md bg-neutral-900 object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-24 w-24 rounded-md bg-neutral-900 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <div className="truncate font-medium text-paper text-lg">
                  {result.title}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5">
                  <Stat label="Price">
                    {currencySymbol(result.currency)}
                    {result.price}
                  </Stat>
                  <Stat label="Stock">
                    <span
                      className={
                        result.available ? "text-green-400" : "text-signal"
                      }
                    >
                      {result.available
                        ? result.quantity !== null
                          ? `${result.quantity} units`
                          : "In stock"
                        : "Out of stock"}
                    </span>
                  </Stat>
                  <Stat label="Variants">{result.variantCount}</Stat>
                  <Stat label="Tracking">Hourly (Pro)</Stat>
                </div>
              </div>
            </div>
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
      )}

      <style>{`
        @keyframes result-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function Stat({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400 font-mono">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-mono text-paper">{children}</div>
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
