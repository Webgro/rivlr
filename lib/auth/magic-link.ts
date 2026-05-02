import { randomBytes, createHash } from "node:crypto";
import { db, schema } from "@/lib/db";
import { eq, and, isNull, lt } from "drizzle-orm";

/**
 * Magic-link generation + verification.
 *
 * Token model:
 *  - 32 random bytes encoded as URL-safe base64 → ~43 chars in URL.
 *  - Only sha256(token) lives in the DB. A leak of `auth_magic_links`
 *    tells an attacker an email had a pending login but not the token
 *    that would consume it.
 *  - Single-use: `used_at` non-null = link consumed, can't replay.
 *  - 15-minute expiry. Long enough for "open inbox, click", short enough
 *    that a stolen-laptop or shared-screen window stays small.
 *
 * Per-email throttle: at most 5 unused links in the last hour. Blocks
 * mailbox bombing of someone who didn't ask to log in.
 */

const TOKEN_BYTES = 32;
const LINK_TTL_MS = 15 * 60 * 1000; // 15 min
const MAX_PENDING_PER_HOUR = 5;
const RECENT_WINDOW_MS = 60 * 60 * 1000;

export interface CreateLinkResult {
  ok: true;
  token: string; // raw, return-once for the email send
  expiresAt: Date;
}

export interface CreateLinkError {
  ok: false;
  error:
    | "rate-limited"
    | "invalid-email";
}

export async function createMagicLink({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo?: string;
}): Promise<CreateLinkResult | CreateLinkError> {
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, error: "invalid-email" };
  }

  // Per-email throttle.
  const recentCutoff = new Date(Date.now() - RECENT_WINDOW_MS);
  const recent = await db
    .select({ id: schema.authMagicLinks.id })
    .from(schema.authMagicLinks)
    .where(
      and(
        eq(schema.authMagicLinks.email, cleanEmail),
        isNull(schema.authMagicLinks.usedAt),
      ),
    );
  const recentUnused = recent.filter(
    (_, i) => i < MAX_PENDING_PER_HOUR + 1, // micro-opt
  );
  if (recentUnused.length >= MAX_PENDING_PER_HOUR) {
    // Check timestamps to avoid the false-positive of having older unused
    // links — only block if N+ are within the recent window.
    const timestamped = await db
      .select({ createdAt: schema.authMagicLinks.createdAt })
      .from(schema.authMagicLinks)
      .where(
        and(
          eq(schema.authMagicLinks.email, cleanEmail),
          isNull(schema.authMagicLinks.usedAt),
        ),
      );
    const inWindow = timestamped.filter(
      (r) => r.createdAt > recentCutoff,
    );
    if (inWindow.length >= MAX_PENDING_PER_HOUR) {
      return { ok: false, error: "rate-limited" };
    }
  }

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + LINK_TTL_MS);

  await db.insert(schema.authMagicLinks).values({
    email: cleanEmail,
    tokenHash,
    expiresAt,
    redirectTo: redirectTo ?? null,
  });

  return { ok: true, token, expiresAt };
}

export type ConsumeLinkResult =
  | { ok: true; email: string; redirectTo: string | null }
  | { ok: false; error: "expired" | "used" | "not-found" };

/**
 * Verify + consume a magic-link token. Single-shot — successful return
 * marks `used_at`, future calls with the same token return "used".
 *
 * Cleans up expired-and-unused rows opportunistically as a side effect
 * (cheap one-row delete query on every verify).
 */
export async function consumeMagicLink(token: string): Promise<ConsumeLinkResult> {
  if (!token || typeof token !== "string") {
    return { ok: false, error: "not-found" };
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const [link] = await db
    .select()
    .from(schema.authMagicLinks)
    .where(eq(schema.authMagicLinks.tokenHash, tokenHash))
    .limit(1);

  // Opportunistic GC.
  await db
    .delete(schema.authMagicLinks)
    .where(
      and(
        isNull(schema.authMagicLinks.usedAt),
        lt(schema.authMagicLinks.expiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
      ),
    );

  if (!link) return { ok: false, error: "not-found" };
  if (link.usedAt) return { ok: false, error: "used" };
  if (link.expiresAt < new Date()) return { ok: false, error: "expired" };

  await db
    .update(schema.authMagicLinks)
    .set({ usedAt: new Date() })
    .where(eq(schema.authMagicLinks.id, link.id));

  return {
    ok: true,
    email: link.email,
    redirectTo: link.redirectTo,
  };
}
