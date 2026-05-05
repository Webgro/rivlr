import { cookies } from "next/headers";
import { isAuthedNew } from "./auth/current-user";

/**
 * Compatibility shim — kept until every server-action callsite has been
 * migrated to `requireUser()` from "@/lib/auth/current-user". Returns
 * true if EITHER:
 *   - the new magic-link session cookie is valid (auth_sessions row check), OR
 *   - the legacy single-password cookie matches SESSION_TOKEN.
 *
 * Both paths grant access during the Phase 3 part 3 cutover so existing
 * server actions don't immediately reject magic-link sessions.
 */
export async function isAuthed(): Promise<boolean> {
  // New flow first — source of truth for authenticated users post-Phase-3.
  if (await isAuthedNew()) return true;

  // Legacy password-gate fallback. Removed when SESSION_TOKEN is
  // unset in the final cleanup commit.
  const expected = process.env.SESSION_TOKEN;
  if (!expected) return false;
  const cookieStore = await cookies();
  const session = cookieStore.get("rivlr_session")?.value;
  return !!session && session === expected;
}
