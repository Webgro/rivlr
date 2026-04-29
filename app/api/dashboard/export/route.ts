import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Streams a CSV of products matching the given dashboard filters. One row
 * per tracked product with current price, stock, store, currency, etc.
 */
export async function GET(request: Request) {
  if (!(await isAuthed())) {
    return new Response("unauthorized", { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const store = url.searchParams.get("store") ?? "";
  const tag = url.searchParams.get("tag") ?? "";

  const conditions: ReturnType<typeof sql>[] = [sql`TRUE`];
  if (store) conditions.push(sql`p.store_domain = ${store}`);
  if (tag) conditions.push(sql`${tag} = ANY(p.tags)`);
  if (q) {
    conditions.push(sql`(
      LOWER(COALESCE(p.title, '')) LIKE ${"%" + q + "%"}
      OR LOWER(p.handle) LIKE ${"%" + q + "%"}
      OR LOWER(p.store_domain) LIKE ${"%" + q + "%"}
    )`);
  }
  const where = conditions.reduce((acc, c, i) =>
    i === 0 ? c : sql`${acc} AND ${c}`,
  );

  type Row = {
    title: string | null;
    url: string;
    store_domain: string;
    handle: string;
    currency: string;
    price: string | null;
    available: boolean | null;
    quantity: number | null;
    last_crawled_at: string | null;
    tags: string[];
    active: boolean;
  };

  const rows = await db.execute<Row>(sql`
    SELECT p.title, p.url, p.store_domain, p.handle, p.currency,
      p.last_crawled_at, p.tags, p.active,
      lp.price, ls.available, ls.quantity
    FROM tracked_products p
    LEFT JOIN LATERAL (
      SELECT price FROM price_observations
      WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
    ) lp ON true
    LEFT JOIN LATERAL (
      SELECT available, quantity FROM stock_observations
      WHERE product_id = p.id ORDER BY observed_at DESC LIMIT 1
    ) ls ON true
    WHERE ${where}
    ORDER BY p.added_at DESC
  `);

  const header = [
    "title",
    "url",
    "store",
    "handle",
    "currency",
    "current_price",
    "in_stock",
    "quantity",
    "last_crawled_at",
    "tags",
    "active",
  ].join(",");

  const lines = [header];
  for (const r of rows) {
    lines.push(
      [
        csv(r.title ?? ""),
        csv(r.url),
        csv(r.store_domain),
        csv(r.handle),
        csv(r.currency),
        r.price ?? "",
        r.available === null ? "" : r.available ? "true" : "false",
        r.quantity ?? "",
        r.last_crawled_at ?? "",
        csv((r.tags ?? []).join("; ")),
        r.active ? "true" : "false",
      ].join(","),
    );
  }

  const body = lines.join("\n");
  const stamp = new Date().toISOString().split("T")[0];
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rivlr-${stamp}.csv"`,
    },
  });
}

function csv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
