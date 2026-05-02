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
}

export async function createSession(opts: {
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const [row] = await db
    .insert(schema.authSessions)
    .values({
      userId: opts.userId,
      expiresAt,
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
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
  const sinceLastSeen = now.getTime() - row.session.lastSeenAt.getTime();
  if (sinceLastSeen > REFRESH_THRESHOLD_MS) {
    const newExpires = new Date(now.getTime() + SESSION_TTL_MS);
    await db
      .update(schema.authSessions)
      .set({ lastSeenAt: now, expiresAt: newExpires })
      .where(eq(schema.authSessions.id, row.session.id));
  }

  return { sessionId: row.session.id, user: row.user };
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
