"use client";

import Link from "next/link";
import { useState } from "react";

interface PreviewResult {
  ok: true;
  title: string;
  storeDomain: string;
  imageUrl: string | null;
  currency: string;
  price: string;
  available: boolean;
  quantity: number | null;
  variantCount: number;
}

/**
 * The hero's primary CTA — a paste-URL bar that resolves to a live product
 * card right inside the hero. Replaces a generic 'Try for free' button
 * with something concrete: visitors can confirm Rivlr works on their
 * actual competitor in one click.
 */
export function HeroDemo() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      if (!res.ok) setError(data.error ?? "Something went wrong");
      else setResult(data);
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      {/* Crosshair frame around the input — only visible on focus */}
      <form onSubmit={submit} className="group relative">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-mono pointer-events-none">
              URL ›
            </span>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-rival.com/products/handle"
              className="w-full rounded-md border border-neutral-700 bg-[#0d0d0d] pl-14 pr-4 py-4 text-base text-paper placeholder-neutral-600 outline-none focus:border-signal/60 focus:shadow-[0_0_0_4px_rgba(255,59,48,0.08)] transition font-mono"
            />
            {/* Corner crosshairs */}
            <Crosshair className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2" />
            <Crosshair className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2" />
            <Crosshair className="absolute left-0 bottom-0 -translate-x-1/2 translate-y-1/2" />
            <Crosshair className="absolute right-0 bottom-0 translate-x-1/2 translate-y-1/2" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-signal px-6 py-4 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50 whitespace-nowrap inline-flex items-center justify-center gap-2"
          >
            {loading ? "Acquiring…" : "Lock on →"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mt-4 rounded-md border border-signal/40 bg-signal/5 px-4 py-3 text-sm text-signal font-mono">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-5 animate-[result-in_0.4s_ease-out]">
          <div className="rounded-xl border border-signal/30 bg-[#0d0d0d] overflow-hidden">
            {/* Lock-on header */}
            <div className="flex items-center gap-2 border-b border-neutral-800 px-4 py-2 bg-[#141414]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
                Target acquired · {result.storeDomain}
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
                  <Stat label="Current price">
                    {currencySymbol(result.currency)}
                    {result.price}
                  </Stat>
                  <Stat label="Stock">
                    <span
                      className={
                        result.available ? "text-green-500" : "text-signal"
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
                  <Stat label="Tracking">Hourly (Pro plan)</Stat>
                </div>
              </div>
            </div>
            <div className="border-t border-neutral-800 px-5 py-3.5 flex items-center justify-between gap-3 bg-[#141414]">
              <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
                ✓ Live data · pulled now
              </span>
              <Link
                href={`/signup?source=hero-demo&url=${encodeURIComponent(url)}`}
                className="rounded-md bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-neutral-200 inline-flex items-center gap-2"
              >
                Track this →
              </Link>
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
      <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-600 font-mono">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-mono text-paper">{children}</div>
    </div>
  );
}

function Crosshair({ className }: { className: string }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={`text-signal/0 group-focus-within:text-signal/60 transition ${className}`}
      aria-hidden
    >
      <path
        d="M0 5 H10 M5 0 V10"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
    </svg>
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
