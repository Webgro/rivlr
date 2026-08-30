import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyShop, getPriceRows } from "@/app/(app)/my-products/data";

export const dynamic = "force-dynamic";

/**
 * The pricing working sheet.
 *
 * One row per product the user sells, with the cheapest rival's price,
 * the gap, and an empty "New price" column to fill in.
 *
 * Rows come from the same getPriceRows the Prices page uses, and the
 * page's filters (q, match, shop) are passed straight through, so the
 * sheet is always exactly what was on screen when the button was
 * pressed. Products with no rival yet are included and carry a note
 * saying so.
 *
 * Deliberately NOT a Shopify import file. Shopify only accepts its own
 * columns, which would mean dropping the competitor prices, and the
 * competitor prices are the entire reason for opening the sheet. The
 * user decides prices here and handles the upload themselves.
 *
 * Handle and SKU are included so rows can be matched back to Shopify.
 */

/** RFC 4180: quote everything, double any inner quotes. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const mine = await getMyShop(user.id);

  const url = new URL(request.url);
  const rows = mine
    ? (
        await getPriceRows(user.id, mine.domain, {
          q: url.searchParams.get("q") ?? undefined,
          match: url.searchParams.get("match") ?? undefined,
          shop: url.searchParams.get("shop") ?? undefined,
        })
      ).rows
    : [];

  // Biggest undercut first: the rows most likely to need a decision.
  // The screen sorts favourites first, but this is a working sheet.
  const ordered = [...rows].sort((a, b) => {
    const aGap =
      a.bestPrice !== null && a.myPrice !== null
        ? a.bestPrice - a.myPrice
        : null;
    const bGap =
      b.bestPrice !== null && b.myPrice !== null
        ? b.bestPrice - b.myPrice
        : null;
    if (aGap === null && bGap === null) return 0;
    if (aGap === null) return 1;
    if (bGap === null) return -1;
    return aGap - bGap;
  });

  const header = [
    "Handle",
    "SKU",
    "Product",
    "Currency",
    "Your price",
    "Cheapest competitor",
    "Their price",
    "Difference",
    "Difference %",
    "Competitors watched",
    "Note",
    "New price",
  ];

  const lines = [header.map(cell).join(",")];

  for (const r of ordered) {
    const mineP = r.myPrice;
    const theirs = r.bestPrice;

    // Same rule the app uses on screen: a product with several variants
    // stores its cheapest, so comparing that against a single-variant
    // listing is not a comparison. Leave the gap blank and say why,
    // rather than exporting a number someone might reprice against.
    const comparable = r.myVariants > 1 === (r.bestVariants ?? 1) > 1;

    let difference = "";
    let differencePct = "";
    let note = "";

    if (theirs === null) {
      note = "No competitor price yet";
    } else if (!comparable) {
      note = "Different sizes or options, check before comparing";
    } else if (mineP !== null) {
      const delta = theirs - mineP;
      difference = delta.toFixed(2);
      differencePct = mineP !== 0 ? ((delta / mineP) * 100).toFixed(1) : "";
      if (delta < 0) note = "They are cheaper";
      else if (delta > 0) note = "You are cheaper";
      else note = "Same price";
    }

    lines.push(
      [
        cell(r.handle),
        cell(r.sku),
        cell(r.title),
        cell(r.currency),
        cell(mineP !== null ? mineP.toFixed(2) : ""),
        cell(r.bestShop),
        cell(theirs !== null ? theirs.toFixed(2) : ""),
        cell(difference),
        cell(differencePct),
        cell(r.rivalShops.length),
        cell(note),
        cell(""),
      ].join(","),
    );
  }

  // BOM so Excel opens UTF-8 product titles correctly rather than
  // mangling accented characters.
  const csv = "﻿" + lines.join("\r\n") + "\r\n";
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rivlr-prices-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
