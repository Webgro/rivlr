import { createHmac } from "node:crypto";

/**
 * One-click unsubscribe tokens. We HMAC-sign (email + issued-at) with a
 * secret so the unsubscribe link can't be forged. Tokens are stateless —
 * verifying just rebuilds the signature, no DB lookup needed.
 *
 * Format: base64url(`${email}.${issuedAt}.${signature}`)
 *
 * Why HMAC over a DB-stored token? Stateless = no extra row to manage,
 * no expiry job, and the token is regenerable for every email send so
 * unsubscribe links never go stale.
 */

function getSecret(): string {
  const s =
    process.env.UNSUBSCRIBE_SECRET ??
    process.env.CRON_SECRET ?? // fallback for early-deploy convenience
    "";
  if (!s) {
    // Safe in dev — verifies still work since we use the same value to sign
    // and verify within a single process. Production should set UNSUBSCRIBE_SECRET.
    return "rivlr-dev-fallback";
  }
  return s;
}

export function makeUnsubscribeToken(email: string): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `${email.toLowerCase()}.${issuedAt}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyUnsubscribeToken(
  token: string,
): { email: string; issuedAt: number } | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf-8");
  } catch {
    return null;
  }
  const parts = decoded.split(".");
  if (parts.length !== 3) return null;
  const [email, issuedAtStr, sig] = parts;
  const issuedAt = parseInt(issuedAtStr, 10);
  if (!email || !Number.isFinite(issuedAt)) return null;

  const expected = createHmac("sha256", getSecret())
    .update(`${email}.${issuedAt}`)
    .digest("hex");

  // Timing-safe compare.
  if (sig.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  return { email, issuedAt };
}

export function unsubscribeUrl(email: string, base = "https://rivlr.app"): string {
  return `${base}/unsubscribe?token=${encodeURIComponent(makeUnsubscribeToken(email))}`;
}
