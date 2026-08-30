"use client";

import { useState, useTransition } from "react";
import type { CatalogueMatch, MatchConfidence } from "@/lib/matching";
import { trackMatchedProducts } from "../(app)/products/track-matched";
import { finishSetup } from "./actions";

function money(value: number | null, currency: string): string {
  if (value === null) return "—";
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

const CONFIDENCE_LABEL: Record<MatchConfidence, string> = {
  exact: "Same product code",
  high: "Almost certainly the same",
  likely: "Looks like a match",
};

function MatchRow({
  match,
  checked,
  onToggle,
}: {
  match: CatalogueMatch;
  checked: boolean;
  onToggle: () => void;
}) {
  const gap = match.priceGap;
  const cheaper = gap !== null && gap < 0;

  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-800 bg-[#111] p-3 hover:border-neutral-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-signal,#e5484d)]"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-paper">{match.myTitle}</p>
          <p className="truncate text-xs text-neutral-500">
            they sell it as {match.theirTitle}
          </p>
          <p className="mt-1 text-[11px] text-neutral-600">
            {CONFIDENCE_LABEL[match.confidence]}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm text-paper">
            {match.theirVariantCount > 1 && (
              <span className="text-neutral-500">from </span>
            )}
            {money(match.theirPrice, match.currency)}
          </p>
          <p className="font-mono text-[11px] text-neutral-500">
            you: {match.myVariantCount > 1 && "from "}
            {money(match.myPrice, match.currency)}
          </p>
          {!match.priceComparable ? (
            <p className="mt-0.5 text-[11px] text-neutral-500">
              different sizes — check before comparing
            </p>
          ) : (
            gap !== null &&
            gap !== 0 && (
              <p
                className={
                  "mt-0.5 text-[11px] " +
                  (cheaper ? "text-signal" : "text-neutral-500")
                }
              >
                {cheaper ? "undercuts you by " : "above you by "}
                {money(Math.abs(gap), match.currency)}
              </p>
            )
          )}
        </div>
      </label>
    </li>
  );
}

/**
 * The payoff step: products the competitor sells that the user also
 * sells, ready to track with the link already made.
 *
 * Everything is ticked by default. The matches are ordered by
 * confidence, the list is short, and each row shows both titles and both
 * prices, so the user can judge any row at a glance and untick the odd
 * one rather than having to opt into every row individually.
 */
export function LinkStep({
  matches,
  competitorDomain,
}: {
  matches: CatalogueMatch[];
  competitorDomain: string;
}) {
  // Pre-tick only what we can stand behind. A match whose two prices
  // cover different variants is probably the right product but its gap
  // is meaningless, so the user opts in to that one deliberately.
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        matches
          .filter((m) => m.priceComparable)
          .map((m) => m.discoveredId),
      ),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const track = () => {
    setError(null);
    startTransition(async () => {
      const pairs = matches
        .filter((m) => selected.has(m.discoveredId))
        .map((m) => ({
          discoveredId: m.discoveredId,
          myProductId: m.myProductId,
        }));
      const result = await trackMatchedProducts(pairs);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong. Try again.");
        return;
      }
      await finishSetup();
    });
  };

  const skip = () => {
    startTransition(async () => {
      await finishSetup();
    });
  };

  return (
    <div className="space-y-5">
      <ul className="space-y-2">
        {matches.map((m) => (
          <MatchRow
            key={m.discoveredId}
            match={m}
            checked={selected.has(m.discoveredId)}
            onToggle={() => toggle(m.discoveredId)}
          />
        ))}
      </ul>

      {error && (
        <p className="text-sm text-signal" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={track}
          disabled={pending || selected.size === 0}
          className="rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-black hover:bg-signal/90 disabled:opacity-60"
        >
          {pending
            ? "Setting up…"
            : `Track ${selected.size} product${selected.size === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          onClick={skip}
          disabled={pending}
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          Not now
        </button>
      </div>

      <p className="text-xs text-neutral-600">
        We&apos;ll check {competitorDomain} for price and stock changes and
        email you when something moves. You can add more competitors any
        time.
      </p>
    </div>
  );
}
