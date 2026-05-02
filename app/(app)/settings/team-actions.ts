"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db, schema, type UserEmail } from "@/lib/db";
import { eq, and, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createMagicLink } from "@/lib/auth/magic-link";
import { sendTeamInviteEmail } from "@/lib/auth/send-team-invite";

/**
 * "Team access" actions — let the account owner authorise additional
 * email addresses to sign in. Single account, multiple authorised inboxes.
 *
 * Intentionally simple: no roles, no permissions. Every authorised
 * email has equal access to all data. If the operator wants role-based
 * access later, role becomes a column on user_emails.
 *
 * Limit: 10 additional emails per account for now. Cheap to bump if a
 * paying customer asks.
 */

const MAX_AUTHORISED_EMAILS = 10;

export interface TeamMember {
  email: string;
  isPrimary: boolean;
  addedAt: Date | null;
  lastUsedAt: Date | null;
}

/** Return the full list of authorised emails for the current account.
 *  Primary user.email is always first; additional ones follow in
 *  added-at order. */
export async function listTeamMembers(): Promise<TeamMember[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  const additional = await db
    .select()
    .from(schema.userEmails)
    .where(eq(schema.userEmails.userId, me.id))
    .orderBy(schema.userEmails.addedAt);
  return [
    {
      email: me.email,
      isPrimary: true,
      addedAt: me.createdAt,
      lastUsedAt: me.lastLoginAt,
    },
    ...additional.map((row: UserEmail) => ({
      email: row.email,
      isPrimary: false,
      addedAt: row.addedAt,
      lastUsedAt: row.lastUsedAt,
    })),
  ];
}

/**
 * Invite a new email to the current account. Sends a magic link that,
 * when clicked, both (a) authorises the email AND (b) signs the recipient
 * in. If the email is already authorised on this account, no-op success.
 * If it's authorised on a DIFFERENT account, we surface a clear error
 * (single-account-mode + email-uniqueness across the whole system).
 */
export async function addAuthorisedEmail(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  message?: string;
}> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Sign in first." };

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That doesn't look like a valid email." };
  }
  if (email === me.email) {
    return { ok: false, error: "That's already your own email." };
  }

  // Check it isn't tied to another user (anywhere — primary or secondary).
  const [otherPrimary] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);
  if (otherPrimary && otherPrimary.id !== me.id) {
    return {
      ok: false,
      error:
        "That email is already on another Rivlr account and can't be invited.",
    };
  }
  const [otherSecondary] = await db
    .select({ userId: schema.userEmails.userId })
    .from(schema.userEmails)
    .where(eq(schema.userEmails.email, email))
    .limit(1);
  if (otherSecondary && otherSecondary.userId !== me.id) {
    return {
      ok: false,
      error:
        "That email is already on another Rivlr account and can't be invited.",
    };
  }

  // Already authorised on this account → resend the invite link rather
  // than erroring (forgiving UX).
  const [alreadyMine] = await db
    .select()
    .from(schema.userEmails)
    .where(
      and(
        eq(schema.userEmails.userId, me.id),
        eq(schema.userEmails.email, email),
      ),
    )
    .limit(1);

  // Capacity check (excluding existing entries to support resend).
  if (!alreadyMine) {
    const [{ count: existingCount }] = await db.execute<{ count: number }>(sql`
      SELECT COUNT(*)::int AS count
      FROM user_emails WHERE user_id = ${me.id}
    `);
    if (existingCount >= MAX_AUTHORISED_EMAILS) {
      return {
        ok: false,
        error: `Up to ${MAX_AUTHORISED_EMAILS} additional emails per account. Email support to raise the limit.`,
      };
    }
    await db.insert(schema.userEmails).values({
      userId: me.id,
      email,
      invitedAt: new Date(),
      invitedByUserId: me.id,
    });
  }

  // Fire the invite email — this is BOTH the authorise step AND the
  // sign-in step. Magic link works exactly the same way; /auth/verify
  // resolves the email via the union lookup so the recipient lands in
  // the inviter's account.
  const link = await createMagicLink({ email, redirectTo: "/dashboard" });
  if (!link.ok) {
    return {
      ok: false,
      error:
        link.error === "rate-limited"
          ? "Too many invite attempts to that address. Wait a minute and retry."
          : "Couldn't generate an invite link.",
    };
  }
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "rivlr.app";
  const url = `${proto}://${host}/auth/verify?token=${link.token}`;

  await sendTeamInviteEmail({
    inviterEmail: me.email,
    inviteeEmail: email,
    url,
    expiresInMinutes: 15,
  });

  revalidatePath("/settings");

  return {
    ok: true,
    message: alreadyMine
      ? `Re-sent the sign-in link to ${email}.`
      : `Invite sent to ${email}. Link expires in 15 minutes.`,
  };
}

/**
 * Remove an authorised email. Can't remove the primary (delete the
 * whole account if you want that). Existing sessions for the removed
 * email keep working until they naturally expire — that's acceptable
 * because the act of removing them is the trigger to also revoke
 * sessions if the operator wants. Future: add a "Sign them out
 * everywhere" follow-up button.
 */
export async function removeAuthorisedEmail(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
}> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "Sign in first." };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "missing email" };
  if (email === me.email) {
    return {
      ok: false,
      error: "You can't remove the primary email this way.",
    };
  }
  await db
    .delete(schema.userEmails)
    .where(
      and(
        eq(schema.userEmails.userId, me.id),
        eq(schema.userEmails.email, email),
      ),
    );
  revalidatePath("/settings");
  return { ok: true };
}
