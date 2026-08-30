import { getCurrentUser } from "@/lib/auth/current-user";
import { getStockRows, WINDOW_DAYS } from "@/app/(app)/stock/data";
import { getVelocity } from "@/lib/velocity";

export const dynamic = "force-dynamic";

/**
 * The rival-stock sheet.
 *
 * One row per rival listing paired to something the user sells: their
 * shop, their price, whether they have it, and the least they have sold
 * in the last week. Sorted the same way the page is, stockouts first,
 * because those are the rows worth acting on.
 *
 * Rows come from the same getStockRows the Stock page uses and the
 * page's filters (q, out, shop) pass straight through, so the sheet is
 * exactly what was on screen — every matching row, not just the page
 * being viewed.
 */

/** RFC 4180: quote everything, double any inner quotes. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const url = new URL(request.url);
  const { rows } = await getStockRows(user.id, {
    q: url.searchParams.get("q") ?? undefined,
    out: url.searchParams.get("out") === "1",
    shop: url.searchParams.get("shop") ?? undefined,
  });

  // One call for the whole sheet, not one per row.
  const velocity = await getVelocity(
    rows.map((r) => r.id),
    WINDOW_DAYS,
  );

  const header = [
    "My product",
    "My product handle",
    "Rival shop",
    "Their product",
    "Currency",
    "Their price",
    "Their stock",
    "Units left",
    `Units sold in ${WINDOW_DAYS} days (at least)`,
  ];

  const lines = [header.map(cell).join(",")];

  for (const r of rows) {
    const state =
      r.available === false
        ? "Out of stock"
        : r.available === true
          ? "In stock"
          : "Not known";

    // Most shops never publish a count, so most rows have no figure.
    // Blank is the honest answer there, and a zero would read as a fact.
    const v = velocity.get(r.id);
    const sold = v && v.reliable && v.unitsSold > 0 ? String(v.unitsSold) : "";

    lines.push(
      [
        cell(r.myTitle ?? r.myHandle),
        cell(r.myHandle),
        cell(r.storeDomain),
        cell(r.title ?? r.handle),
        cell(r.currency),
        cell(r.price !== null ? r.price.toFixed(2) : ""),
        cell(state),
        cell(r.quantity !== null ? r.quantity : ""),
        cell(sold),
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
      "Content-Disposition": `attachment; filename="rivlr-rival-stock-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
