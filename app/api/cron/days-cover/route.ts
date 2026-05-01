import { NextResponse } from "next/server";
import { sendDaysCoverWarnings } from "@/lib/email/days-cover-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Daily 09:00 UTC cron — sends days-cover warnings for competitor
 * products at risk of going out of stock. 7-day per-product dedupe.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await sendDaysCoverWarnings();
  return NextResponse.json(result);
}
