"use client";

import { useState, useTransition } from "react";

/**
 * Overage pack picker for Pro subscribers. Live local stepper for
 * preview, posts to /api/billing/overage on confirm. Stripe charges the
 * prorated delta immediately; the page re-renders with the new pack
 * count once the webhook reconciles.
 *
 * Shows what *will* be billed at the next renewal (full price × packs)
 * so the user knows what their recurring monthly cost looks like, plus
 * a small note that proration applies right now.
 */
export function OveragePackPicker({
  currentPacks,
  maxPacks,
  packPriceGbp,
  productsPerPack,
}: {
  currentPacks: number;
  maxPacks: number;
  packPriceGbp: number;
  productsPerPack: number;
}) {
  const [packs, setPacks] = useState<number>(currentPacks);
  const [isPending, startTransition] = useTransition();

  const dirty = packs !== currentPacks;
  const additionalProducts = packs * productsPerPack;
  const monthlyOverage = packs * packPriceGbp;
  const delta = packs - currentPacks;

  function decrement() {
    if (packs > 0) setPacks((p) => p - 1);
  }
  function increment() {
    if (packs < maxPacks) setPacks((p) => p + 1);
  }
  function setExact(n: number) {
    setPacks(Math.max(0, Math.min(maxPacks, Math.round(n))));
  }
  function reset() {
    setPacks(currentPacks);
  }

  return (
    <section className="mt-6 rounded-xl border border-default bg-elevated p-5">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted/70 font-mono">
            Overage packs
          </div>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight">
            Track more than 400 products
          </h2>
        </div>
        <div className="text-[11px] text-muted">
          £{packPriceGbp} per pack · {productsPerPack} products each · max{" "}
          {maxPacks}
        </div>
      </div>

      <p className="mt-2 text-xs text-muted leading-relaxed">
        Each pack adds {productsPerPack} products to your tracking limit.
        Charged immediately, prorated to the rest of this billing period;
        adds to your recurring monthly cost from the next invoice.
      </p>

      {/* Stepper */}
      <div className="mt-5 flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={decrement}
          disabled={packs === 0 || isPending}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-default bg-surface text-lg leading-none hover:border-strong transition disabled:opacity-40"
          aria-label="Decrease packs"
        >
          −
        </button>

        <input
          type="number"
          min={0}
          max={maxPacks}
          value={packs}
          onChange={(e) => setExact(parseInt(e.target.value || "0", 10))}
          disabled={isPending}
          className="h-9 w-16 rounded-md border border-default bg-surface px-2 text-center text-sm font-mono text-foreground outline-none focus:border-strong"
        />

        <button
          type="button"
          onClick={increment}
          disabled={packs === maxPacks || isPending}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-default bg-surface text-lg leading-none hover:border-strong transition disabled:opacity-40"
          aria-label="Increase packs"
        >
          +
        </button>

        <span className="text-xs text-muted">
          = +{additionalProducts} products
        </span>

        {packs >= maxPacks && (
          <span className="text-[11px] text-amber-500">
            Max reached — email support for higher allowances.
          </span>
        )}
      </div>

      {/* Predictive billing display */}
      <div className="mt-5 grid gap-2 rounded-md border border-default bg-surface p-4 text-sm">
        <div className="flex justify-between gap-2">
          <span className="text-muted">Effective product cap</span>
          <span className="font-mono">{400 + additionalProducts}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted">Pro base</span>
          <span className="font-mono">£59.99 / mo</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted">
            Overage ({packs} × £{packPriceGbp})
          </span>
          <span className="font-mono">
            £{(packs * packPriceGbp).toFixed(2)} / mo
          </span>
        </div>
        <div className="border-t border-default pt-2 flex justify-between gap-2">
          <span className="font-medium">Total recurring</span>
          <span className="font-mono font-medium">
            £{(59.99 + monthlyOverage).toFixed(2)} / mo
          </span>
        </div>
      </div>

      {/* Confirm row — only visible while there's a pending change. */}
      {dirty && (
        <form
          action="/api/billing/overage"
          method="post"
          className="mt-4 flex items-center gap-3 flex-wrap justify-end"
          onSubmit={(e) => {
            // Disable client-side state so the user doesn't double-click
            // and trigger two redirects mid-Stripe-call.
            startTransition(() => {
              // Form submit will navigate; nothing else needed.
              void e;
            });
          }}
        >
          <input type="hidden" name="packs" value={packs} />
          <span className="text-xs text-muted">
            {delta > 0
              ? `Adding ${delta} pack${delta === 1 ? "" : "s"} — prorated charge happens now.`
              : `Removing ${Math.abs(delta)} pack${Math.abs(delta) === 1 ? "" : "s"} — credit applied to next invoice.`}
          </span>
          <button
            type="button"
            onClick={reset}
            disabled={isPending}
            className="rounded-md border border-default bg-surface px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-strong transition disabled:opacity-50"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-foreground px-4 py-1.5 text-xs font-medium text-surface hover:opacity-90 transition disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Confirm change"}
          </button>
        </form>
      )}
    </section>
  );
}
