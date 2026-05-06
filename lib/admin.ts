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
