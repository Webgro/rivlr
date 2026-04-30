import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { CountUp } from "./count-up";

/**
 * Live status pill rendered into the hero. Pulls REAL counts from the DB:
 * how many products Rivlr is currently tracking and how many distinct
 * stores. Numbers count up from 0 on first paint via the CountUp client
 * component.
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
          <CountUp to={trackedCount} className="text-paper" /> products across{" "}
          <CountUp to={storeCount} className="text-paper" /> stores · right now
        </>
      ) : (
        <>Intel online</>
      )}
    </span>
  );
}
