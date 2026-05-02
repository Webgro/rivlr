import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { createSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Magic-link landing endpoint. The user clicks the link in their email
 * → land here → we exchange the token for a session cookie and redirect
 * them to /dashboard (or wherever the original ?next= pointed).
 *
 * Idempotent failures: bad / expired / used links bounce back to /login
 * with a friendly error code rather than 4xx-ing in the browser.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing-token", url));
  }

  const result = await consumeMagicLink(token);
  if (!result.ok) {
    const code =
      result.error === "expired"
        ? "expired"
        : result.error === "used"
          ? "used"
          : "invalid";
    return NextResponse.redirect(new URL(`/login?error=${code}`, url));
  }

  // Find or create the user. First-signup-adopts-existing-data happens
  // in Phase 3 commit 2 — for now, just create a barebones user row.
  let [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, result.email))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(schema.users)
      .values({
        email: result.email,
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
      })
      .returning();
  } else {
    await db
      .update(schema.users)
      .set({
        lastLoginAt: new Date(),
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      })
      .where(eq(schema.users.id, user.id));
  }

  const h = await headers();
  await createSession({
    userId: user.id,
    ip: h.get("x-forwarded-for") ?? null,
    userAgent: h.get("user-agent") ?? null,
  });

  // Resolve safe redirect — only allow same-origin paths.
  const redirectTo =
    result.redirectTo && result.redirectTo.startsWith("/")
      ? result.redirectTo
      : "/dashboard";

  return NextResponse.redirect(new URL(redirectTo, url));
}
