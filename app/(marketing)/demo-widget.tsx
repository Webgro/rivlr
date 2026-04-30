"use client";

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

export function DemoWidget() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
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
        setError(data.error ?? "Something went wrong");
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#141414] p-6 md:p-8">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/products/some-handle"
          className="flex-1 rounded-md border border-neutral-700 bg-[#0a0a0a] px-4 py-3 text-sm text-paper placeholder-neutral-500 outline-none focus:border-neutral-500 font-mono"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-signal px-5 py-3 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Checking…" : "Check it →"}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-md border border-signal/40 bg-signal/10 px-4 py-3 text-sm text-signal">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-5">
          <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] overflow-hidden">
            <div className="grid grid-cols-[auto_1fr] gap-4 p-4 sm:p-5 items-center">
              {result.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={result.imageUrl}
                  alt=""
                  className="h-20 w-20 rounded-md bg-neutral-900 object-cover flex-shrink-0"
                />
              ) : (
                <div className="h-20 w-20 rounded-md bg-neutral-900 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-mono">
                  {result.storeDomain}
                </div>
                <div className="mt-1 truncate font-medium text-paper">
                  {result.title}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-mono text-paper">
                    {currencySymbol(result.currency)}
                    {result.price}
                  </span>
                  <span className="text-neutral-700">·</span>
                  <span
                    className={`inline-flex items-center gap-2 ${result.available ? "text-green-500" : "text-signal"}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${result.available ? "bg-green-500" : "bg-signal"}`}
                    />
                    {result.available
                      ? result.quantity !== null
                        ? `${result.quantity} in stock`
                        : "In stock"
                      : "Out of stock"}
                  </span>
                  {result.variantCount > 1 && (
                    <>
                      <span className="text-neutral-700">·</span>
                      <span className="text-xs text-neutral-500 font-mono">
                        {result.variantCount} variants
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-neutral-800 px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3">
              <span className="text-xs text-neutral-500 font-mono">
                ✓ Live data · pulled now
              </span>
              <a
                href={`/signup?source=demo&url=${encodeURIComponent(url)}`}
                className="rounded-md bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-neutral-200"
              >
                Start tracking →
              </a>
            </div>
          </div>
          <p className="mt-3 text-xs text-neutral-500 font-mono">
            Imagine seeing this for hundreds of competitor products, hourly,
            with email alerts when something changes.
          </p>
        </div>
      )}
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
