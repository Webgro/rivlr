import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Retention sweep for crawl_jobs.
 *
 * A crawl job is a unit of work, not a record worth keeping: once it has
 * run, the result it produced lives in price_observations and
 * stock_observations, and the row itself is read only by the dashboard's
 * progress widget, which looks at the last hour. Nothing had ever
 * deleted them, so the table had grown to 585,000 rows and 145 MB —
 * larger than the price history it was bookkeeping for — with records
 * going back to the first day the crawler ran.
 *
 * The sweep runs at the end of each dispatch rather than on a cron of
 * its own. Dispatch has already woken the database, and on Neon's usage
 * billing an extra scheduled wake-up is the expensive part; the delete
 * itself is trivial by comparison.
 */

/** Jobs older than this are deleted, whatever their status. */
const RETENTION_DAYS = 7;
/** Rows per statement. Small enough that no single delete takes a long
 *  lock or drags a large transaction behind it. */
const CHUNK = 5_000;
/** Ceiling per dispatch, so a large backlog is cleared over several
 *  runs instead of making one dispatch run long and risk its timeout.
 *  Steady state is ~10,800 jobs a day against 450 crawls an hour, so
 *  this keeps well ahead of intake. */
const MAX_PER_RUN = 25_000;

export async function pruneCrawlJobs(): Promise<number> {
  let deleted = 0;

  while (deleted < MAX_PER_RUN) {
    // The subquery bounds each statement to CHUNK rows. Deleting by a
    // bare age predicate would match the whole backlog in one
    // statement, which is the shape that has caused trouble here before.
    const [row] = await db.execute<{ n: number }>(sql`
      WITH doomed AS (
        SELECT id FROM crawl_jobs
        WHERE scheduled_for < NOW() - MAKE_INTERVAL(days => ${RETENTION_DAYS})
        LIMIT ${CHUNK}
      ), del AS (
        DELETE FROM crawl_jobs
        WHERE id IN (SELECT id FROM doomed)
        RETURNING 1
      )
      SELECT COUNT(*)::int AS n FROM del
    `);
    const n = row?.n ?? 0;
    if (n === 0) break;
    deleted += n;
  }

  return deleted;
}
