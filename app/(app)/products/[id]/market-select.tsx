"use client";

import { useState } from "react";
import { COMMON_MARKETS } from "@/lib/crawler/shopify";
import { setProductMarket } from "../actions";

/**
 * Per-product market picker. Sends a server action to update the product's
 * marketCountry + marketCurrency. The hourly crawl picks up the new market
 * on its next run via Shopify Markets cookies.
 */
export function MarketSelect({
  productId,
  initialCountry,
  initialCurrency,
}: {
  productId: string;
  initialCountry: string | null;
  initialCurrency: string | null;
}) {
  const initial = `${initialCountry ?? "GB"}|${initialCurrency ?? "GBP"}`;
  const [value, setValue] = useState(initial);
  const dirty = value !== initial;

  return (
    <form
      action={setProductMarket}
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
    >
      <input type="hidden" name="id" value={productId} />
      <input type="hidden" name="country" value={value.split("|")[0]} />
      <input type="hidden" name="currency" value={value.split("|")[1]} />
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-default bg-surface px-2.5 py-1.5 text-sm font-mono outline-none hover:border-strong focus:border-strong"
      >
        {COMMON_MARKETS.map((m) => (
          <option key={`${m.country}|${m.currency}`} value={`${m.country}|${m.currency}`}>
            {m.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!dirty}
        className="rounded-md border border-default bg-surface px-3 py-1.5 text-sm hover:border-strong disabled:opacity-50"
      >
        Save market
      </button>
      <span className="text-xs text-muted">
        Forces this market's currency on the next crawl. Old price history
        keeps its original currency.
      </span>
    </form>
  );
}
