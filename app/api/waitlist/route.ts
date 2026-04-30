import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";

export const dynamic = "force-dynamic";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { email?: string; storeUrl?: string; source?: string }
    | null;

  const email = body?.email?.trim().toLowerCase();
  if (!email || !EMAIL_RX.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email." },
      { status: 400 },
    );
  }

  const storeUrl = body?.storeUrl?.trim() || null;
  const source = body?.source?.trim().slice(0, 32) || "unknown";

  await db.insert(schema.waitlist).values({ email, storeUrl, source });

  return NextResponse.json({ ok: true });
}
