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

