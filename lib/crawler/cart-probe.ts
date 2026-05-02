import { buildMarketHeaders, type Market } from "./shopify";

/**
 * Inventory probe via Shopify's /cart/add.js endpoint.
 *
 * Background: many merchants hide `inventory_quantity` from public endpoints
 * but they cannot hide it from the cart-add endpoint without breaking
 * checkout. When you POST a quantity higher than the available stock,
 * Shopify returns a 422 with the exact remaining quantity in the error
 * message — that's what we parse out.
 *
 * Behaviour matrix:
 *   - 200 OK         → store accepted PROBE_QUANTITY units. Either the
 *                      product genuinely has 1M+ in stock (very rare) OR
 *                      the variant has inventory_policy='continue'
 *                      (oversell-allowed). Either way we return null.
 *   - 422 + parsed N → exact stock. Return N.
 *   - 422 unparsable → "Sold out" / no number. Return null.
 *   - 403 / 429      → bot protection. Return { blocked: true }.
 *   - other          → null.
 *
 * The probe never actually completes a checkout — Shopify's cart is
 * server-side per session and we never set a session cookie. The
 * `cart-tokens` we'd touch are ephemeral, never linked to a real user.
 *
 * Rate-limited at the orchestrator layer; this function makes one HTTP
 * request and returns.
 */

const PROBE_QUANTITY = 999_999;

const RIVLR_USER_AGENT =
  "Mozilla/5.0 (compatible; RivlrBot/1.0; +https://rivlr.app/bot)";

/** Patterns Shopify uses across themes / locales. Order matters — earlier
 *  patterns are more specific. The captured group must be the integer
 *  remaining stock. New ones get appended as we encounter them in the
 *  wild — keep the comment with a real example for traceability. */
const ERROR_PATTERNS: RegExp[] = [
  // "Only 1504 items were added to your cart due to availability." —
  // themes that cap the add silently rather than reject it. The number
  // IS the actual available stock at the moment of probe.
  /only\s+(\d+)\s+(?:item|product|unit|piece)s?\s+(?:were|are|have\s+been|will\s+be)\s+added/i,
  // "There are only 47 [variant] left." — most common, modern Online Store 2.0.
  /there\s+are\s+only\s+(\d+)\b/i,
  // "All 12 of [variant] are in your cart." — when probe quantity exceeds total.
  /all\s+(\d+)\s+of\s+/i,
  // "You can only add 5 of [variant] to the cart." — newer phrasing.
  /you\s+can\s+only\s+add\s+(\d+)/i,
  // "Only 8 left" / "Only 8 items" / "Only 8 in stock" — broadened
  // to include unit nouns since Shopify uses "items" in some 4xx bodies.
  /only\s+(\d+)\s+(?:item|product|unit|piece)s?\b/i,
  /only\s+(\d+)\s+(?:left|in\s+stock|remaining|available)/i,
  // "8 in stock" / "8 left" — terse formats.
  /\b(\d+)\s+(?:in\s+stock|left\s+in\s+stock|remaining|available\b)/i,
  // "in stock: 8" — colon-based format some themes emit.
  /(?:stock|inventory|qty|quantity)\s*[:\-]?\s*(\d+)\b/i,
  // "you've added the maximum (8) of this item" / "max 8 per cart"
  /\bmax(?:imum)?\s*(?:of\s*)?\(?(\d+)\)?/i,
  // Pure number with units like "8 units"
  /\b(\d+)\s+units?\b/i,
];

export interface ProbeDebug {
  /** Raw HTTP status code from /cart/add.js. */
  status: number;
  /** Whatever string Shopify put in description / message / errors. */
  message: string | null;
  /** Which regex matched (index into ERROR_PATTERNS), -1 if none. */
  matchedPatternIndex: number;
}

export type ProbeResult =
  | { kind: "exact"; quantity: number; debug: ProbeDebug }
  | { kind: "unbounded"; debug: ProbeDebug }
  | { kind: "soldout"; debug: ProbeDebug }
  | { kind: "blocked"; debug: ProbeDebug }
  | { kind: "unknown"; debug: ProbeDebug };

/**
 * Probes a single variant. Caller is responsible for politeness (per-store
 * gap, retry backoff, etc.) — this function fires one request and
 * classifies the response.
 */
export async function probeVariantInventory(
  storeDomain: string,
  variantId: number | string,
  market?: Market | null,
): Promise<ProbeResult> {
  const url = `https://${storeDomain}/cart/add.js`;
  const body = new URLSearchParams({
    id: String(variantId),
    quantity: String(PROBE_QUANTITY),
  }).toString();

  const debug: ProbeDebug = {
    status: 0,
    message: null,
    matchedPatternIndex: -1,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        ...buildMarketHeaders(market),
        "User-Agent": RIVLR_USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        // Some themes redirect /cart/add to /cart on success — Shopify
        // checks Referer + X-Requested-With to opt into JSON behaviour.
        "X-Requested-With": "XMLHttpRequest",
        Referer: `https://${storeDomain}/`,
      },
      body,
      cache: "no-store",
    });
  } catch {
    return { kind: "unknown", debug };
  }

  debug.status = res.status;

  if (res.status === 403 || res.status === 429) {
    return { kind: "blocked", debug };
  }

  // Try to read the body whether 2xx or 4xx — some 200 responses carry
  // useful info too (e.g. when the store returned the cart line item with
  // adjusted quantity capped at available stock).
  let raw = "";
  try {
    raw = await res.text();
  } catch {
    // ignore
  }

  let data: unknown;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }

  const message = extractMessage(data) ?? raw.slice(0, 500);
  debug.message = message || null;

  // 2xx with a "quantity" field → cart line item was created. The quantity
  // it actually accepted IS the available stock. This catches the case
  // where Shopify caps your add (rare but happens on some themes).
  if (res.ok && data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.quantity === "number" && obj.quantity < PROBE_QUANTITY) {
      return { kind: "exact", quantity: obj.quantity, debug };
    }
    // Otherwise 200 with no signal = unbounded (oversell-allowed or massive stock).
    return { kind: "unbounded", debug };
  }

  if (res.status !== 422) {
    return { kind: "unknown", debug };
  }

  if (!message) {
    return { kind: "unknown", debug };
  }

  // Out-of-stock detection — return soldout BEFORE running the parser so
  // a number elsewhere in the message doesn't get mistaken for stock.
  if (
    /\bsold\s+out\b/i.test(message) ||
    /\bunavailable\b/i.test(message) ||
    /\bno\s+longer\s+available\b/i.test(message) ||
    /\bcannot\s+(?:be\s+)?(?:add|purchas)/i.test(message)
  ) {
    return { kind: "soldout", debug };
  }

  for (let i = 0; i < ERROR_PATTERNS.length; i++) {
    const m = message.match(ERROR_PATTERNS[i]);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 0 && n < 10_000_000) {
        debug.matchedPatternIndex = i;
        return { kind: "exact", quantity: n, debug };
      }
    }
  }
  return { kind: "unknown", debug };
}

function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  // Common scalar keys.
  const candidates = [obj.description, obj.message, obj.error];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c;
  }

  // Newer Shopify error format: { errors: { "0": ["msg"] } } or { errors: ["msg"] }.
  if (obj.errors) {
    if (Array.isArray(obj.errors)) {
      for (const e of obj.errors) {
        if (typeof e === "string" && e.trim().length > 0) return e;
      }
    } else if (typeof obj.errors === "object") {
      for (const v of Object.values(obj.errors)) {
        if (typeof v === "string" && v.trim().length > 0) return v;
        if (Array.isArray(v)) {
          for (const e of v) {
            if (typeof e === "string" && e.trim().length > 0) return e;
          }
        }
      }
    }
  }
  return null;
}
