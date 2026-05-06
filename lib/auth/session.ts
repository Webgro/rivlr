import { cookies } from "next/headers";
import { db, schema, type User } from "@/lib/db";
import { eq, gt, and, lt } from "drizzle-orm";

/**
 * Session management. Stateful — sessions live in DB so revocation
 * is instantaneous (delete the row). Cookie carries the session id;
 * value isn't sensitive in isolation (must match a row).
 *
 * Rolling 30-day expiry: lastSeenAt updates on every authed request,
 * expiresAt extends from there. Sessions older than 30 days without
 * activity are silently expired by the proxy.
 *
 * Cookie name: `rivlr_auth` — distinct from the legacy `rivlr_session`
 * (single-password gate) so both can coexist during the migration.
 */

const COOKIE_NAME = "rivlr_auth";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // refresh if <1d since last extension

export interface SessionWithUser {
  sessionId: string;
  user: User;
  /** When non-null, this session is an admin impersonating `user`.
   *  The impersonator is the admin acting on the target's behalf;
   *  the (app) layout reads this to render the impersonation banner
   *  and the audit log uses it when stamping actions. */
  impersonator: User | null;
}

export async function createSession(opts: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
  /** Set this when an admin starts impersonating another user — stored
   *  on the session row so getSession() can flag it everywhere and
   *  the audit log keeps a complete record. */
  impersonatorUserId?: string | null;
}): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const [row] = await db
    .insert(schema.authSessions)
    .values({
      userId: opts.userId,
      expiresAt,
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
      impersonatorUserId: opts.impersonatorUserId ?? null,
    })
    .returning({ id: schema.authSessions.id });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, row.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });

  return row.id;
}

/**
 * Fetch the session + its user for the current request, refreshing the
 * sliding expiry if it's been more than 24h. Returns null when no
 * cookie, no matching session, or the session has expired.
 */
export async function getSession(): Promise<SessionWithUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const now = new Date();
  const [row] = await db
    .select({
      session: schema.authSessions,
      user: schema.users,
    })
    .from(schema.authSessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.authSessions.userId))
    .where(
      and(
        eq(schema.authSessions.id, sessionId),
        gt(schema.authSessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) return null;

  // Sliding refresh — only when stale enough to be worth a write.
  // Skip the refresh on impersonation sessions so they don't outlive the
  // admin's intent (they're meant to be short-lived; admin clicks Stop
  // when done, otherwise the original 30-day expiry from create still
  // applies).
  const sinceLastSeen = now.getTime() - row.session.lastSeenAt.getTime();
  if (
    !row.session.impersonatorUserId &&
    sinceLastSeen > REFRESH_THRESHOLD_MS
  ) {
    const newExpires = new Date(now.getTime() + SESSION_TTL_MS);
    await db
      .update(schema.authSessions)
      .set({ lastSeenAt: now, expiresAt: newExpires })
      .where(eq(schema.authSessions.id, row.session.id));
  }

  // Resolve the impersonator user if present. Separate query is fine —
  // happens at most once per request, only on impersonation sessions.
  let impersonator: User | null = null;
  if (row.session.impersonatorUserId) {
    const [imp] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, row.session.impersonatorUserId))
      .limit(1);
    impersonator = imp ?? null;
  }

  return { sessionId: row.session.id, user: row.user, impersonator };
}

/** Delete the current session row + clear the cookie. Idempotent. */
export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(COOKIE_NAME)?.value;
  if (sessionId) {
    await db
      .delete(schema.authSessions)
      .where(eq(schema.authSessions.id, sessionId));
  }
  cookieStore.delete(COOKIE_NAME);
}

/** Background prune — call from any cron occasionally. Cheap. */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await db
    .delete(schema.authSessions)
    .where(lt(schema.authSessions.expiresAt, new Date()))
    .returning({ id: schema.authSessions.id });
  return result.length;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
