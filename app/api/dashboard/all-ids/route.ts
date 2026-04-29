import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { isAuthed } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Returns the IDs of every product matching the given dashboard filters,
 * across all pages. Used by the 'select all <N> across all pages' option
 * in the bulk action bar.
 */
export async function GET(request: Request) {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const store = url.searchParams.get("store") ?? "";
  const tag = url.searchParams.get("tag") ?? "";

  const conditions: ReturnType<typeof sql>[] = [sql`TRUE`];
  if (store) conditions.push(sql`store_domain = ${store}`);
  if (tag) conditions.push(sql`${tag} = ANY(tags)`);
  if (q) {
    conditions.push(sql`(
      LOWER(COALESCE(title, '')) LIKE ${"%" + q + "%"}
      OR LOWER(handle) LIKE ${"%" + q + "%"}
      OR LOWER(store_domain) LIKE ${"%" + q + "%"}
    )`);
  }

  const where = conditions.reduce((acc, c, i) =>
    i === 0 ? c : sql`${acc} AND ${c}`,
  );

  const rows = await db.execute<{ id: string }>(sql`
    SELECT id FROM tracked_products WHERE ${where}
  `);

  return NextResponse.json({ ids: Array.from(rows).map((r) => r.id) });
}
