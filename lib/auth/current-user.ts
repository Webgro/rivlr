import { redirect } from "next/navigation";
import { type User } from "@/lib/db";
import { getSession } from "./session";

/**
 * Read the currently signed-in user (or null) for any server action,
 * route handler, or server component.
 *
 * Cheap: one DB read per call, but the session row already needs to be
 * fetched anyway for cookie validation. We don't memo per-request because
 * Next.js 16's `cache()` doesn't apply across server-action boundaries
 * cleanly — keep it simple, the query is tiny.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Strict variant — redirects to /login when no session. Use from any
 * server action or page that requires authentication. Sets `?next=` so
 * the user comes back to where they were trying to go after sign-in.
 */
export async function requireUser(returnTo?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const next = returnTo ?? "/dashboard";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return user;
}

/**
 * True when the given user has admin access. Two signals, either grants:
 *   1. users.is_admin = true (the canonical source).
 *   2. user.id is in ADMIN_USER_IDS (comma-separated env var) — bootstrap
 *      escape hatch for cases where the DB flag isn't set yet (e.g. a
 *      fresh deploy with no admin row).
 *
 * Designed to fail closed: a missing env var + missing flag = no admin.
 */
export function isAdminUser(user: User): boolean {
  if (user.isAdmin) return true;
  const env = process.env.ADMIN_USER_IDS ?? "";
  if (!env.trim()) return false;
  const allowed = new Set(
    env
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return allowed.has(user.id);
}

/**
 * requireUser + admin gate. Redirects unauthed → /login; signed-in but
 * non-admin → /dashboard (we don't want to advertise that /admin even
 * exists by 404'ing). Returns the User for downstream use.
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (!isAdminUser(user)) {
    redirect("/dashboard");
  }
  return user;
}

