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
  // "There are only 47 [variant] left." — most common, modern Online Store 2.0.
  /there\s+are\s+only\s+(\d+)\s+\S/i,
  // "All 12 of [variant] are in your cart." — when probe quantity exceeds total.
  /all\s+(\d+)\s+of\s+\S+\s+are\s+in\s+your\s+cart/i,
  // "You can only add 5 of [variant] to the cart." — newer phrasing.
  /you\s+can\s+only\s+add\s+(\d+)/i,
  // "Only 8 left" — short variant some themes synthesise from API data.
  /only\s+(\d+)\s+left/i,
  // Generic "n available" — Plus / custom themes occasionally.
  /(\d+)\s+available/i,
];

export type ProbeResult =
  | { kind: "exact"; quantity: number }
  | { kind: "unbounded" }
  | { kind: "soldout" }
  | { kind: "blocked" }
  | { kind: "unknown" };

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

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        ...buildMarketHeaders(market),
        "User-Agent": RIVLR_USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
      cache: "no-store",
      redirect: "manual", // some stores 30x to a checkout flow on success
    });
  } catch {
    return { kind: "unknown" };
  }

  if (res.status === 403 || res.status === 429) {
    return { kind: "blocked" };
  }

  // 200 = oversell or unbounded. Treat as no useful number.
  if (res.ok) return { kind: "unbounded" };

  if (res.status !== 422) return { kind: "unknown" };

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { kind: "unknown" };
  }

  const message = extractMessage(data);
  if (!message) return { kind: "unknown" };

  // Out-of-stock detection — return soldout BEFORE running the parser so
  // a number elsewhere in the message doesn't get mistaken for stock.
  if (
    /\bsold\s+out\b/i.test(message) ||
    /\bunavailable\b/i.test(message) ||
    /\bno\s+longer\s+available\b/i.test(message)
  ) {
    return { kind: "soldout" };
  }

  for (const re of ERROR_PATTERNS) {
    const m = message.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 0 && n < 10_000_000) {
        return { kind: "exact", quantity: n };
      }
    }
  }
  return { kind: "unknown" };
}

function extractMessage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  // Common keys Shopify uses across themes.
  const candidates = [obj.description, obj.message, obj.error];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c;
  }
  return null;
}
