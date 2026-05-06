"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  scanStoreCatalogue,
  type ScanResult,
  type ScanProduct,
} from "./scan-actions";
import { addProducts } from "./actions";

/**
 * "Track a whole store" tab. User pastes a store URL, we hit
 * /collections/all/products.json, return a count + 50-item preview
 * + the user's current quota.
 *
 * Two paths from there:
 *   1. Their plan covers everything → "Track all N" big button.
 *   2. Plan doesn't cover everything → grid with checkboxes capped at
 *      remaining quota, plus a plan-recommendation banner showing the
 *      cheapest tier that would fit.
 *
 * No data is written until the user explicitly confirms the selection.
 * Preview is image + title only — Stock and price get crawled after
 * the products are accepted into tracked_products by addProducts().
 */
export function ScanStore() {
  const [storeUrl, setStoreUrl] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, startScan] = useTransition();

  function onScan(e: React.FormEvent) {
    e.preventDefault();
    if (!storeUrl.trim()) return;
    startScan(async () => {
      const r = await scanStoreCatalogue(storeUrl);
      setResult(r);
    });
  }

  function reset() {
    setResult(null);
    setStoreUrl("");
  }

  return (
    <div>
      {/* URL input — always visible at the top */}
      <form onSubmit={onScan} className="space-y-3">
        <div>
          <label
            htmlFor="store-url"
            className="block text-xs uppercase tracking-wider text-muted font-mono"
          >
            Store URL
          </label>
          <input
            id="store-url"
            type="text"
            value={storeUrl}
            onChange={(e) => setStoreUrl(e.target.value)}
            placeholder="gymshark.com — or https://allbirds.co.uk"
            required
            disabled={scanning}
            className="mt-2 block w-full rounded-md border border-default bg-elevated px-3 py-2.5 text-sm text-foreground placeholder-muted shadow-sm outline-none font-mono leading-5 focus:border-strong disabled:opacity-60"
          />
          <p className="mt-1 text-xs text-muted">
            We&apos;ll fetch the public catalogue and show you what&apos;s
            inside before tracking anything.
          </p>
        </div>

        <div className="flex items-center gap-3 justify-end">
          {result && (
            <button
              type="button"
              onClick={reset}
              disabled={scanning}
              className="text-xs text-muted hover:text-foreground transition"
            >
              Scan a different store
            </button>
          )}
          <button
            type="submit"
            disabled={scanning || !storeUrl.trim()}
            className="rounded-md bg-foreground px-5 py-2 text-sm font-medium text-surface hover:opacity-90 transition disabled:opacity-50 inline-flex items-center gap-2"
          >
            {scanning ? (
              <>
                <span className="rivlr-spinner" aria-hidden />
                Scanning…
              </>
            ) : (
              "Scan store →"
            )}
          </button>
        </div>
      </form>

      {/* Results below the form */}
      {result && !result.ok && (
        <div className="mt-6 rounded-lg border border-signal/40 bg-signal/[0.04] px-5 py-4 text-sm">
          <div className="text-signal font-medium">Couldn&apos;t scan</div>
          <div className="mt-1 text-muted">{result.error}</div>
        </div>
      )}

      {result && result.ok && <ScanResultsView result={result} />}
    </div>
  );
}

/* ─── Results view ────────────────────────────────────────────────── */

function ScanResultsView({
  result,
}: {
  result: Extract<ScanResult, { ok: true }>;
}) {
  const { storeDomain, total, capped, products, gridCap, quota } = result;
  const remaining = quota.remaining; // null = unlimited
  const limit = quota.limit;
  // Whether the user's plan can fit every product the scan returned.
  // Drives the "Track all N" primary CTA.
  const canTrackAll = remaining === null || total <= remaining;

  // First N products for the visual grid. Bulk track-all uses the full
  // `products` array.
  const visible = products.slice(0, gridCap);

  // Default selection: first N visible products, capped at quota.remaining.
  const initialSelected = (() => {
    const cap = remaining === null ? visible.length : Math.min(visible.length, remaining);
    return new Set(visible.slice(0, cap).map((p) => p.handle));
  })();

  return (
    <div className="mt-8 space-y-6">
      <ResultsHeader storeDomain={storeDomain} total={total} capped={capped} />
      <PlanBanner total={total} quota={quota} />
      {canTrackAll && (
        <TrackAllButton
          products={products}
          total={total}
          storeDomain={storeDomain}
        />
      )}
      <SelectionGrid
        visible={visible}
        total={total}
        initialSelected={initialSelected}
        remaining={remaining}
        limit={limit}
        canTrackAll={canTrackAll}
      />
    </div>
  );
}

/* ─── Bulk track-all CTA ──────────────────────────────────────────── */

function TrackAllButton({
  products,
  total,
  storeDomain,
}: {
  products: ScanProduct[];
  total: number;
  storeDomain: string;
}) {
  const [submitting, startSubmit] = useTransition();

  function trackAll(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("urls", products.map((p) => p.url).join("\n"));
    startSubmit(async () => {
      await addProducts(fd);
    });
  }

  return (
    <form
      onSubmit={trackAll}
      className="rounded-xl border border-signal/30 bg-signal/[0.04] p-5 flex items-center justify-between gap-4 flex-wrap"
    >
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.2em] text-signal font-mono">
          One-click bulk
        </div>
        <div className="mt-1.5 text-base font-semibold tracking-tight">
          Track every product on{" "}
          <span className="font-mono text-muted-strong">{storeDomain}</span>
        </div>
        <p className="mt-1 text-xs text-muted leading-relaxed">
          Adds all {total} products to your watchlist. The first crawl
          starts immediately — prices and stock will populate within a
          few minutes.
        </p>
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-signal px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition disabled:opacity-50 inline-flex items-center gap-2 flex-shrink-0"
      >
        {submitting ? (
          <>
            <span className="rivlr-spinner" aria-hidden />
            Adding {total}…
          </>
        ) : (
          <>Track all {total} →</>
        )}
      </button>
    </form>
  );
}

function ResultsHeader({
  storeDomain,
  total,
  capped,
}: {
  storeDomain: string;
  total: number;
  capped: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted/70 font-mono">
        Catalogue scan
      </div>
      <h2 className="mt-1.5 text-xl font-semibold tracking-tight">
        {capped ? `${total}+ products` : `${total} products`} on{" "}
        <span className="font-mono text-muted-strong">{storeDomain}</span>
      </h2>
      <p className="mt-1 text-xs text-muted">
        {capped
          ? `Showing the first ${total}. Larger catalogues are capped here so the scan stays snappy — split by collection URL if you need to go deeper.`
          : `We grabbed image + title only — price and stock crawl after you confirm which to track.`}
      </p>
    </div>
  );
}

/* ─── Plan recommendation banner ──────────────────────────────────── */

interface PlanRecommendation {
  tone: "ok" | "info" | "warning";
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}

function recommendPlan(
  total: number,
  quota: Extract<ScanResult, { ok: true }>["quota"],
): PlanRecommendation {
  // Owner / unlimited plans.
  if (quota.limit === null) {
    return {
      tone: "ok",
      title: `Your plan covers all ${total} products.`,
      body: `Unlimited tracking — pick whatever you want.`,
    };
  }

  const remaining = quota.remaining ?? 0;

  // The whole catalogue fits in current remaining quota.
  if (total <= remaining) {
    return {
      tone: "ok",
      title: `Your ${quota.plan.toUpperCase()} plan has room for all ${total}.`,
      body: `Track everything in one click — your remaining quota is ${remaining} products.`,
    };
  }

  // Compute the cheapest tier that would cover the whole catalogue.
  // free=5, starter=50, growth=150, pro=400, pro+packs up to 5000.
  const PLAN_LIMITS: Array<{ plan: string; cap: number; price: string }> = [
    { plan: "Starter", cap: 50, price: "£14.99/mo" },
    { plan: "Growth", cap: 150, price: "£29.99/mo" },
    { plan: "Pro", cap: 400, price: "£59.99/mo" },
  ];
  const fitsTier = PLAN_LIMITS.find((t) => total <= t.cap);

  if (fitsTier) {
    return {
      tone: "info",
      title: `${total} is more than your ${quota.plan.toUpperCase()} plan covers.`,
      body: `Upgrade to ${fitsTier.plan} (${fitsTier.price}) and track all ${total} in one go. Or pick up to ${remaining} below to stay on your current plan.`,
      ctaLabel: `Upgrade to ${fitsTier.plan} →`,
      ctaHref: `/billing?upgrade=${fitsTier.plan.toLowerCase()}`,
    };
  }

  // Pro + overage.
  if (total <= 5000) {
    const packs = Math.ceil((total - 400) / 100);
    const monthly = 59.99 + packs * 15;
    return {
      tone: "info",
      title: `${total} products needs Pro + ${packs} overage pack${packs === 1 ? "" : "s"}.`,
      body: `Pro at £59.99 plus £${(packs * 15).toFixed(2)} for ${packs} pack${packs === 1 ? "" : "s"} (+${packs * 100} products) = £${monthly.toFixed(2)}/mo. Buy in-app once you upgrade. Or pick up to ${remaining} below now.`,
      ctaLabel: `Upgrade to Pro →`,
      ctaHref: `/billing?upgrade=pro`,
    };
  }

  // Custom tier territory.
  return {
    tone: "warning",
    title: `${total} products is beyond our self-serve tiers.`,
    body: `Above 5,000 products we set up a custom plan. Email hello@rivlr.app and we'll size one for you. Meanwhile pick up to ${remaining} below to start.`,
  };
}

function PlanBanner({
  total,
  quota,
}: {
  total: number;
  quota: Extract<ScanResult, { ok: true }>["quota"];
}) {
  const r = recommendPlan(total, quota);
  const styles =
    r.tone === "ok"
      ? "border-green-500/30 bg-green-500/[0.04]"
      : r.tone === "warning"
        ? "border-amber-500/40 bg-amber-500/[0.05]"
        : "border-signal/30 bg-signal/[0.04]";
  return (
    <div className={`rounded-lg border ${styles} px-5 py-4 text-sm`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">{r.title}</div>
          <div className="mt-1 text-xs text-muted leading-relaxed">{r.body}</div>
        </div>
        {r.ctaHref && (
          <Link
            href={r.ctaHref}
            className="rounded-md bg-foreground px-3.5 py-1.5 text-xs font-medium text-surface hover:opacity-90 transition flex-shrink-0"
          >
            {r.ctaLabel ?? "View plans →"}
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─── Selection grid ──────────────────────────────────────────────── */

function SelectionGrid({
  visible,
  total,
  initialSelected,
  remaining,
  limit,
  canTrackAll,
}: {
  visible: ScanProduct[];
  total: number;
  initialSelected: Set<string>;
  remaining: number | null;
  limit: number | null;
  /** True when the user's plan covers everything — flips the
   *  "more than shown" footer copy from "upgrade or paste URLs"
   *  to "use Track all N above". */
  canTrackAll: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(initialSelected);
  const [submitting, startSubmit] = useTransition();

  function toggle(handle: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(handle)) {
        next.delete(handle);
      } else {
        // Cap at remaining quota.
        if (remaining !== null && next.size >= remaining) return prev;
        next.add(handle);
      }
      return next;
    });
  }

  function selectMax() {
    const cap = remaining === null ? visible.length : Math.min(visible.length, remaining);
    setSelected(new Set(visible.slice(0, cap).map((p) => p.handle)));
  }

  function clear() {
    setSelected(new Set());
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selected.size === 0) return;
    const fd = new FormData();
    const urls = visible
      .filter((p) => selected.has(p.handle))
      .map((p) => p.url)
      .join("\n");
    fd.set("urls", urls);
    startSubmit(async () => {
      await addProducts(fd);
    });
  }

  const maxSelectable =
    remaining === null
      ? visible.length
      : Math.min(visible.length, remaining);
  const atCap = remaining !== null && selected.size >= remaining;
  const moreThanShown = total > visible.length;

  return (
    <form onSubmit={onSubmit}>
      {/* Selection toolbar */}
      <div className="rounded-t-lg border border-default bg-elevated px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm">
            <span className="font-mono font-semibold text-foreground">
              {selected.size}
            </span>
            <span className="text-muted">
              {limit === null
                ? ` selected · unlimited`
                : ` / ${maxSelectable} selectable on your current plan`}
            </span>
          </span>
          {atCap && (
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-amber-500 font-mono">
              Plan cap
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clear}
            disabled={selected.size === 0 || submitting}
            className="rounded-md border border-default bg-surface px-2.5 py-1 text-xs text-muted hover:text-foreground hover:border-strong transition disabled:opacity-50"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={selectMax}
            disabled={submitting}
            className="rounded-md border border-default bg-surface px-2.5 py-1 text-xs text-foreground hover:border-strong transition disabled:opacity-50"
          >
            {limit === null ? "Select all" : `Select ${maxSelectable}`}
          </button>
        </div>
      </div>

      {/* Pick-from-list explainer */}
      <div className="border-x border-default bg-elevated px-4 py-2 text-[11px] text-muted/80 font-mono">
        Or pick specific products below ({visible.length} shown
        {moreThanShown && total > visible.length ? ` of ${total}` : ""}):
      </div>

      {/* Grid */}
      <div className="border-x border-default bg-elevated">
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
          {visible.map((p) => {
            const isSelected = selected.has(p.handle);
            const blockedByCap = !isSelected && atCap;
            return (
              <li key={p.handle}>
                <button
                  type="button"
                  onClick={() => toggle(p.handle)}
                  disabled={blockedByCap}
                  className={`group w-full text-left rounded-md border p-2 transition ${
                    isSelected
                      ? "border-signal bg-signal/[0.04]"
                      : blockedByCap
                        ? "border-default bg-surface opacity-40 cursor-not-allowed"
                        : "border-default bg-surface hover:border-strong"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                        isSelected
                          ? "border-signal bg-signal text-white"
                          : "border-default bg-elevated"
                      }`}
                      aria-hidden
                    >
                      {isSelected && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 12 L10 17 L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="aspect-square rounded bg-elevated overflow-hidden mb-2 border border-default">
                        {p.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] text-muted/60 font-mono">
                            no image
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-medium leading-snug line-clamp-2">
                        {p.title}
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {moreThanShown && (
          <div className="px-4 py-3 border-t border-default text-xs text-muted leading-relaxed">
            Showing the first {visible.length} of {total} products in the
            grid.{" "}
            {canTrackAll
              ? "To bulk-track everything, use the “Track all” button above the grid."
              : "Upgrade to a plan that covers more, or use the URLs tab to paste specific handles."}
          </div>
        )}
      </div>

      {/* Confirm bar */}
      <div className="rounded-b-lg border border-t-0 border-default bg-elevated px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-muted">
          Stock and price crawl starts as soon as you confirm.
        </span>
        <button
          type="submit"
          disabled={selected.size === 0 || submitting}
          className="rounded-md bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition disabled:opacity-50 inline-flex items-center gap-2"
        >
          {submitting ? (
            <>
              <span className="rivlr-spinner" aria-hidden />
              Adding…
            </>
          ) : (
            <>Track {selected.size} product{selected.size === 1 ? "" : "s"} →</>
          )}
        </button>
      </div>
    </form>
  );
}
