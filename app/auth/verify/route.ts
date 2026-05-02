import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq, sql, isNull } from "drizzle-orm";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { createSession } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

/**
 * Magic-link landing endpoint. Three flows handled here:
 *
 *  1. First-ever sign-up: create the user AND adopt every existing
 *     untenanted row (NULL user_id) into their account. This carries
 *     the operator's pre-Phase-3 data forward without manual migration.
 *
 *  2. Returning user OR additional authorised email: lookup the email
 *     across users.email AND user_emails.email, resolve to the parent
 *     user, create a session.
 *
 *  3. Unknown email after at least one user exists: reject. We're in
 *     single-account-mode for now — random sign-ups would otherwise
 *     create competing accounts that see no data and confuse everyone.
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

  const email = result.email.toLowerCase();

  // 1. Resolve the email → user via union of users.email + user_emails.email.
  let user = await resolveUserByEmail(email);

  // 2. No user yet for this email. Two sub-cases:
  if (!user) {
    const [{ count: existingUserCount }] = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count FROM users
    `);

    if (existingUserCount === 0) {
      // First-ever signup — create the user AND adopt all NULL-userId rows.
      [user] = await db
        .insert(schema.users)
        .values({
          email,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
        })
        .returning();
      await adoptAllExistingData(user.id);

      // Fire welcome email — best effort, don't block the redirect.
      try {
        const built = welcomeEmail({ email });
        await sendEmail({
          to: [email],
          subject: built.subject,
          html: built.html,
          text: built.text,
        });
      } catch {
        // best effort
      }
    } else {
      // Single-account-mode: an account exists but this email isn't on it.
      // Reject with a clear message rather than silently creating a competing
      // tenant that would see no data.
      return NextResponse.redirect(
        new URL("/login?error=not-invited", url),
      );
    }
  } else {
    // Existing user (or authorised secondary email). Bump lastLogin /
    // verified state.
    await db
      .update(schema.users)
      .set({
        lastLoginAt: new Date(),
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      })
      .where(eq(schema.users.id, user.id));

    // If the matched email is a secondary, bump its lastUsedAt too.
    await db
      .update(schema.userEmails)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.userEmails.email, email));
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

/**
 * Look up a user by primary email OR any authorised additional email.
 * Returns the parent user row in either case.
 */
async function resolveUserByEmail(email: string) {
  const [primary] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (primary) return primary;

  const [secondary] = await db
    .select({ user: schema.users })
    .from(schema.userEmails)
    .innerJoin(schema.users, eq(schema.users.id, schema.userEmails.userId))
    .where(eq(schema.userEmails.email, email))
    .limit(1);
  return secondary?.user ?? null;
}

/**
 * One-shot adoption of pre-Phase-3 untenanted rows. Runs once when the
 * very first user signs up. Wraps every per-user table's UPDATE in a
 * single transaction so partial-failure leaves nothing inconsistent.
 *
 * Any row with user_id IS NULL gets claimed. Subsequent users start
 * with their own scope (no claim runs again because the FROM users
 * count check above gates this branch).
 */
async function adoptAllExistingData(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE tracked_products SET user_id = ${userId} WHERE user_id IS NULL
    `);
    await tx.execute(sql`
      UPDATE discovered_products SET user_id = ${userId} WHERE user_id IS NULL
    `);
    await tx.execute(sql`
      UPDATE tags SET user_id = ${userId} WHERE user_id IS NULL
    `);
    await tx.execute(sql`
      UPDATE product_groups SET user_id = ${userId} WHERE user_id IS NULL
    `);
    await tx.execute(sql`
      UPDATE link_suggestions SET user_id = ${userId} WHERE user_id IS NULL
    `);
  });
}

// Keep the unused-import suppression friendly.
void Resend;
void isNull;
