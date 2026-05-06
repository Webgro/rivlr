import { db, schema, type User } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  createSession,
  destroyCurrentSession,
  getSession,
} from "@/lib/auth/session";

/**
 * Admin helpers — write the audit log + apply state changes against
 * other users. Kept off the hot path; call only from /admin server
 * actions / route handlers that have already passed requireAdmin().
 *
 * Every mutation here also writes an admin_audit_log row stamped with
 * the actor's email + the target's email at write time, so the log
 * stays human-readable even after either user is deleted.
 */

interface AuditWriteOpts {
  actor: User;
  targetUserId: string | null;
  targetEmail: string | null;
  action: string;
  payload?: Record<string, unknown>;
}

/** Persist an audit log entry. Best-effort: errors are logged but not
 *  thrown — the audit log is observability, not a correctness gate. */
export async function writeAudit(opts: AuditWriteOpts): Promise<void> {
  try {
    await db.insert(schema.adminAuditLog).values({
      actorUserId: opts.actor.id,
      actorEmail: opts.actor.email,
      targetUserId: opts.targetUserId,
      targetEmail: opts.targetEmail,
      action: opts.action,
      payload: opts.payload ?? {},
    });
  } catch (err) {
    console.warn(`[admin audit] failed to record "${opts.action}":`, err);
  }
}

/* ─── Comp plan management ────────────────────────────────────────── */

export type CompPlan =
  | "free"
  | "starter"
  | "growth"
  | "pro"
  | "owner"
  | "unlimited";

/**
 * Set a user's comp_plan override. Plan resolver returns this value
 * instead of consulting their subscription state. Reason is required —
 * it shows up alongside the comp on /admin and in the audit payload.
 */
export async function setCompPlan({
  actor,
  targetUserId,
  plan,
  reason,
}: {
  actor: User;
  targetUserId: string;
  plan: CompPlan;
  reason: string;
}): Promise<void> {
  if (!reason.trim()) {
    throw new Error("Comp reason is required.");
  }
  const [target] = await db
    .select({ email: schema.users.email, currentComp: schema.users.compPlan })
    .from(schema.users)
    .where(eq(schema.users.id, targetUserId))
    .limit(1);
  if (!target) throw new Error("User not found.");

  await db
    .update(schema.users)
    .set({
      compPlan: plan,
      compReason: reason.trim(),
      compSetAt: new Date(),
    })
    .where(eq(schema.users.id, targetUserId));

  await writeAudit({
    actor,
    targetUserId,
    targetEmail: target.email,
    action: "set_comp_plan",
    payload: { from: target.currentComp, to: plan, reason },
  });
}

/** Remove a comp override; resolver falls back to subscription state. */
export async function clearCompPlan({
  actor,
  targetUserId,
}: {
  actor: User;
  targetUserId: string;
}): Promise<void> {
  const [target] = await db
    .select({ email: schema.users.email, currentComp: schema.users.compPlan })
    .from(schema.users)
    .where(eq(schema.users.id, targetUserId))
    .limit(1);
  if (!target) throw new Error("User not found.");

  await db
    .update(schema.users)
    .set({ compPlan: null, compReason: null, compSetAt: null })
    .where(eq(schema.users.id, targetUserId));

  await writeAudit({
    actor,
    targetUserId,
    targetEmail: target.email,
    action: "clear_comp_plan",
    payload: { from: target.currentComp },
  });
}

/* ─── Admin role toggle ───────────────────────────────────────────── */

/* ─── Account creation ───────────────────────────────────────────── */

import { createMagicLink } from "@/lib/auth/magic-link";
import { sendMagicLinkEmail } from "@/lib/auth/send-magic-link";

export interface CreateUserResult {
  ok: true;
  userId: string;
  email: string;
}

/**
 * Admin-initiated account creation. Builds a users row for a prospect
 * email — no magic link sent, no Stripe customer, no automatic comp.
 * Caller decides whether to apply a comp or send an invite afterwards.
 *
 * Refuses if the email is already on a users row OR a user_emails
 * row — single-account-mode is enforced everywhere.
 */
export async function createUserOnBehalf({
  actor,
  email,
  compPlan,
  compReason,
}: {
  actor: User;
  email: string;
  compPlan?: CompPlan;
  compReason?: string;
}): Promise<CreateUserResult> {
  const cleaned = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    throw new Error("Invalid email address.");
  }
  // Same uniqueness checks the team-invite flow does — primary AND
  // secondary emails across the whole system.
  const [existingPrimary] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, cleaned))
    .limit(1);
  if (existingPrimary) {
    throw new Error("An account already exists for that email.");
  }
  const [existingSecondary] = await db
    .select({ userId: schema.userEmails.userId })
    .from(schema.userEmails)
    .where(eq(schema.userEmails.email, cleaned))
    .limit(1);
  if (existingSecondary) {
    throw new Error(
      "That email is already a team-access email on another account.",
    );
  }

  const [newUser] = await db
    .insert(schema.users)
    .values({
      email: cleaned,
    })
    .returning({ id: schema.users.id, email: schema.users.email });

  // Apply optional comp atomically with the create — admin doesn't have
  // to run a second action.
  if (compPlan) {
    if (!compReason || !compReason.trim()) {
      throw new Error("Comp reason is required when applying a comp plan.");
    }
    await db
      .update(schema.users)
      .set({
        compPlan,
        compReason: compReason.trim(),
        compSetAt: new Date(),
      })
      .where(eq(schema.users.id, newUser.id));
  }

  await writeAudit({
    actor,
    targetUserId: newUser.id,
    targetEmail: newUser.email,
    action: "create_user",
    payload: compPlan
      ? { with_comp: compPlan, comp_reason: compReason }
      : undefined,
  });

  return { ok: true, userId: newUser.id, email: newUser.email };
}

/**
 * Send a fresh sign-in magic link to a user — used at the handover
 * moment when an admin's done populating a prospect's account and
 * wants the prospect to log in for the first time.
 *
 * Throws on rate-limit / invalid-email; caller surfaces the error.
 * Audit-logged so we know when handovers happened.
 */
export async function sendMagicLinkAsAdmin({
  actor,
  targetUserId,
}: {
  actor: User;
  targetUserId: string;
}): Promise<void> {
  const [target] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, targetUserId))
    .limit(1);
  if (!target) throw new Error("User not found.");

  const link = await createMagicLink({
    email: target.email,
    redirectTo: "/dashboard",
  });
  if (!link.ok) {
    throw new Error(
      link.error === "rate-limited"
        ? "Too many sign-in links sent to that address recently. Try again in an hour."
        : "Couldn't generate a sign-in link.",
    );
  }

  // Build the absolute URL the same way /login does.
  // We can't use next/headers here (lib code, no request context) —
  // fall back to APP_URL env or rivlr.app default.
  const origin = process.env.APP_URL ?? "https://rivlr.app";
  const url = `${origin}/auth/verify?token=${link.token}`;

  await sendMagicLinkEmail({
    email: target.email,
    url,
    expiresInMinutes: 15,
  });

  await writeAudit({
    actor,
    targetUserId: target.id,
    targetEmail: target.email,
    action: "send_signin_link",
  });
}

/* ─── Impersonation ──────────────────────────────────────────────── */

/**
 * Start impersonating another user. Destroys the admin's current
 * session, creates a fresh session for the target user with
 * impersonator_user_id = admin, and writes an audit row.
 *
 * After this returns, the cookie points to the impersonation session.
 * Admin browses the app as the target user; banner in (app) layout
 * surfaces the override.
 */
export async function startImpersonation({
  actor,
  targetUserId,
}: {
  actor: User;
  targetUserId: string;
}): Promise<void> {
  if (actor.id === targetUserId) {
    throw new Error("You're already signed in as yourself.");
  }
  const [target] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, targetUserId))
    .limit(1);
  if (!target) throw new Error("User not found.");

  // Drop the admin's current session — they're switching identity.
  // Their other tabs / devices are unaffected because each session is
  // its own row.
  await destroyCurrentSession();
  await createSession({
    userId: target.id,
    impersonatorUserId: actor.id,
  });

  await writeAudit({
    actor,
    targetUserId: target.id,
    targetEmail: target.email,
    action: "start_impersonation",
  });
}

/**
 * Stop the current impersonation. Destroys the impersonation session,
 * creates a fresh session for the original admin, writes an audit row.
 *
 * No-op + throws when called outside an impersonation session — guards
 * against the route handler being hit by a regular user.
 */
export async function stopImpersonation(): Promise<{
  adminUserId: string;
  targetEmail: string;
}> {
  const session = await getSession();
  if (!session?.impersonator) {
    throw new Error("Not currently impersonating anyone.");
  }
  const admin = session.impersonator;
  const targetEmail = session.user.email;

  await destroyCurrentSession();
  await createSession({ userId: admin.id });

  await writeAudit({
    actor: admin,
    targetUserId: session.user.id,
    targetEmail,
    action: "stop_impersonation",
  });

  return { adminUserId: admin.id, targetEmail };
}

/** Promote / demote a user to admin. Self-demotion is allowed but
 *  obviously discouraged — the bootstrap env var is the recovery
 *  path if this gets misused. */
export async function setIsAdmin({
  actor,
  targetUserId,
  isAdmin,
}: {
  actor: User;
  targetUserId: string;
  isAdmin: boolean;
}): Promise<void> {
  const [target] = await db
    .select({ email: schema.users.email, current: schema.users.isAdmin })
    .from(schema.users)
    .where(eq(schema.users.id, targetUserId))
    .limit(1);
  if (!target) throw new Error("User not found.");
  if (target.current === isAdmin) return; // no-op

  await db
    .update(schema.users)
    .set({ isAdmin })
    .where(eq(schema.users.id, targetUserId));

  await writeAudit({
    actor,
    targetUserId,
    targetEmail: target.email,
    action: isAdmin ? "grant_admin" : "revoke_admin",
  });
}
