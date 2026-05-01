import { NextResponse } from "next/server";
import { sendWeeklyDigest } from "@/lib/email/digest-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Weekly digest cron — Monday 09:00 UTC. Sends a single summary email
 * per recipient covering the last 7 days of price moves, stock changes,
 * new launches and current OOS competitors.
 *
 * Skips entirely when there's nothing to report (avoids "empty digest"
 * emails that erode the perceived value of the weekly send).
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sendWeeklyDigest();
  return NextResponse.json(result);
}
