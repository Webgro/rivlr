import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Live status pill rendered into the hero. Pulls REAL counts from the DB:
 * how many products Rivlr is currently tracking and how many distinct
 * stores. Makes the marketing page feel alive — and proves the product
 * works at scale before the visitor signs up.
 */
export async function LivePill() {
  let trackedCount = 0;
  let storeCount = 0;
  try {
    const [row] = await db.execute<{ products: number; stores: number }>(sql`
      SELECT
        COUNT(*)::int AS products,
        COUNT(DISTINCT store_domain)::int AS stores
      FROM tracked_products
      WHERE active = true
    `);
    trackedCount = row?.products ?? 0;
    storeCount = row?.stores ?? 0;
  } catch {
    // Silent fall-through to generic pill.
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-[#0d0d0d] pl-2.5 pr-3 py-1 text-[10px] uppercase tracking-[0.18em] font-mono text-neutral-300">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75 animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
      </span>
      {trackedCount > 0 ? (
        <>
          Tracking{" "}
          <span className="text-paper">{trackedCount.toLocaleString()}</span>{" "}
          products across{" "}
          <span className="text-paper">{storeCount}</span> stores · right now
        </>
      ) : (
        <>Intel online</>
      )}
    </span>
  );
}
