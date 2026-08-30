import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

/**
 * The pricing working sheet.
 *
 * One row per product the user sells that has at least one competitor
 * attached, with their price, the cheapest competitor's price, the gap,
 * and an empty "New price" column to fill in.
 *
 * Deliberately NOT a Shopify import file. Shopify only accepts its own
 * columns, which would mean dropping the competitor prices, and the
 * competitor prices are the entire reason for opening the sheet. The
 * user decides prices here and handles the upload themselves.
 *
 * Handle and SKU are included so rows can be matched back to Shopify.
 */

type Row = {
  handle: string;
  sku: string | null;
  title: string | null;
  currency: string;
  my_price: string | null;
  my_variants: number;
  their_store: string | null;
  their_price: string | null;
  their_variants: number | null;
  competitor_count: number | null;
};

/** RFC 4180: quote everything, double any inner quotes. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });

  const rows = await db.execute<Row>(sql`
    WITH mine AS (
      SELECT p.id, p.title, p.handle, p.currency, p.latest_price, p.skus,
             p.group_id,
             COALESCE(array_length(p.skus, 1), 1) AS variants
      FROM tracked_products p
      JOIN user_store_prefs usp
        ON usp.user_id = p.user_id
       AND usp.domain = p.store_domain
       AND usp.is_my_store = true
      WHERE p.user_id = ${user.id}::uuid
        AND p.active = true
        AND p.group_id IS NOT NULL
    ),
    competitors AS (
      SELECT
        c.group_id, c.store_domain, c.latest_price,
        COALESCE(array_length(c.skus, 1), 1) AS variants,
        ROW_NUMBER() OVER (
          PARTITION BY c.group_id ORDER BY c.latest_price ASC
        ) AS rn,
        COUNT(*) OVER (PARTITION BY c.group_id) AS total
      FROM tracked_products c
      LEFT JOIN user_store_prefs own
        ON own.user_id = c.user_id
       AND own.domain = c.store_domain
       AND own.is_my_store = true
      WHERE c.user_id = ${user.id}::uuid
        AND c.active = true
        AND c.latest_price IS NOT NULL
        AND own.domain IS NULL
        AND c.group_id IN (SELECT group_id FROM mine)
    )
    SELECT
      m.handle,
      m.skus[1] AS sku,
      m.title,
      m.currency,
      m.latest_price::text AS my_price,
      m.variants AS my_variants,
      c.store_domain AS their_store,
      c.latest_price::text AS their_price,
      c.variants AS their_variants,
      c.total::int AS competitor_count
    FROM mine m
    LEFT JOIN competitors c ON c.group_id = m.group_id AND c.rn = 1
    ORDER BY
      -- Biggest undercut first: the rows most likely to need a decision.
      CASE
        WHEN c.latest_price IS NULL OR m.latest_price IS NULL THEN 1 ELSE 0
      END,
      (c.latest_price - m.latest_price) ASC
  `);

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
    "Competitors tracked",
    "Note",
    "New price",
  ];

  const lines = [header.map(cell).join(",")];

  for (const r of Array.from(rows)) {
    const mine = r.my_price !== null ? Number(r.my_price) : null;
    const theirs = r.their_price !== null ? Number(r.their_price) : null;

    // Same rule the app uses on screen: a product with several variants
    // stores its cheapest, so comparing that against a single-variant
    // listing is not a comparison. Leave the gap blank and say why,
    // rather than exporting a number someone might reprice against.
    const comparable =
      (Number(r.my_variants) > 1) === (Number(r.their_variants ?? 1) > 1);

    let difference = "";
    let differencePct = "";
    let note = "";

    if (theirs === null) {
      note = "No competitor price yet";
    } else if (!comparable) {
      note = "Different sizes or options, check before comparing";
    } else if (mine !== null) {
      const delta = theirs - mine;
      difference = delta.toFixed(2);
      differencePct = mine !== 0 ? ((delta / mine) * 100).toFixed(1) : "";
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
        cell(mine !== null ? mine.toFixed(2) : ""),
        cell(r.their_store),
        cell(theirs !== null ? theirs.toFixed(2) : ""),
        cell(difference),
        cell(differencePct),
        cell(r.competitor_count ?? 0),
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
