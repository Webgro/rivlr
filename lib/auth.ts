import { cookies } from "next/headers";

/**
 * Phase 1 server-side auth helper. Used by Server Actions and route handlers
 * that aren't covered by proxy.ts (like the manual /api/crawl/run-now
 * trigger). Phase 2 replaces this with Better Auth.
 */
export async function isAuthed(): Promise<boolean> {
  const expected = process.env.SESSION_TOKEN;
  if (!expected) return false;
  const cookieStore = await cookies();
  const session = cookieStore.get("rivlr_session")?.value;
  return !!session && session === expected;
}
