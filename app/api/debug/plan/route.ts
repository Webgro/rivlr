import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";
import { getCurrentPlan } from "@/lib/plan";

/**
 * TEMPORARY diagnostic endpoint — confirms what the plan resolver actually
 * sees in production. Sign-in required; output is intentionally verbose
 * so we can tell whether the OWNER_USER_ID env var is being read, what
 * it's being compared against, and whether the subscriptions table query
 * works.
 *
 * REMOVE THIS FILE after the issue is diagnosed.
 */
export async function GET() {
  const user = await requireUser();

  const ownerEnv = process.env.OWNER_USER_ID ?? null;
  const ownerEnvLength = ownerEnv?.length ?? 0;

  // Try the subscriptions table — if the table doesn't exist on prod yet
  // the query throws and we report it instead of crashing the page.
  let subRowExists: boolean | string = false;
  try {
    const [row] = await db
      .select({ status: schema.subscriptions.status })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, user.id))
      .limit(1);
    subRowExists = !!row;
  } catch (err) {
    subRowExists = err instanceof Error ? `error: ${err.message}` : "error";
  }

  const resolvedPlan = await getCurrentPlan();

  return NextResponse.json({
    sessionUserId: user.id,
    sessionUserIdLength: user.id.length,
    ownerEnv,
    ownerEnvLength,
    exactMatch: ownerEnv === user.id,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    subRowExists,
    resolvedPlan,
  });
}
