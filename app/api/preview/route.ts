import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  parseShopifyUrl,
  fetchShopifyProduct,
  fetchShopifyCurrency,
  summariseProduct,
  penceToDecimal,
} from "@/lib/crawler/shopify";

export const dynamic = "force-dynamic";

const RATE_COOKIE = "rivlr_preview_uses";
const MAX_PREVIEWS = 3;
const WINDOW_HOURS = 24;

/**
 * Public marketing-landing endpoint. Takes a Shopify URL, fetches it once,
 * returns a small JSON for the live demo card.
 *
 * Rate limiting: cookie-based, 3 previews per 24 hours per browser. Not
 * cryptographically secure (cookies can be cleared) but sufficient
 * deterrent for casual abuse. Server-side IP rate limit can be added later
 * via Upstash Ratelimit when actual abuse is observed.
 *
 * Non-Shopify URLs return a friendly 'we only support Shopify for now'
 * error rather than a generic parsing failure.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { url?: string }
    | null;
  const rawUrl = body?.url?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  // Quick shape check — does it look like a Shopify product URL? Catch
  // common alternatives so we can show the 'Shopify only for now' message
  // rather than 'invalid URL'.
  const looksLikeShopify = /\/products\//i.test(rawUrl);
  if (!looksLikeShopify) {
    return NextResponse.json(
      {
        error:
          "Rivlr currently only tracks Shopify stores. WooCommerce, BigCommerce, and others are on the roadmap. Try a URL like https://store.com/products/handle.",
        kind: "non-shopify",
      },
      { status: 400 },
    );
  }

  const parsed = parseShopifyUrl(rawUrl);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "That doesn't look like a Shopify product URL. Expected format: https://store.com/products/handle",
        kind: "invalid",
      },
      { status: 400 },
    );
  }

  // Rate limit check — read existing cookie.
  const cookieStore = await cookies();
  const existing = cookieStore.get(RATE_COOKIE)?.value;
  let uses: { count: number; resetAt: number } = { count: 0, resetAt: 0 };
  if (existing) {
    try {
      uses = JSON.parse(existing);
    } catch {
      uses = { count: 0, resetAt: 0 };
    }
  }

  // Reset the window if expired.
  const now = Date.now();
  if (uses.resetAt < now) {
    uses = { count: 0, resetAt: now + WINDOW_HOURS * 60 * 60 * 1000 };
  }

  if (uses.count >= MAX_PREVIEWS) {
    const hoursLeft = Math.max(
      1,
      Math.ceil((uses.resetAt - now) / (60 * 60 * 1000)),
    );
    return NextResponse.json(
      {
        error: `You've used your ${MAX_PREVIEWS} free previews for now. Sign up to track unlimited products. (Resets in ${hoursLeft}h.)`,
        kind: "rate-limited",
      },
      { status: 429 },
    );
  }

  let currency = "GBP";
  try {
    currency = await fetchShopifyCurrency(parsed.storeDomain);
  } catch {
    // ignore
  }

  let product;
  try {
    product = await fetchShopifyProduct(parsed.productJsUrl);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Couldn't fetch this product: ${err.message}`
            : "Couldn't fetch this product",
        kind: "fetch-failed",
      },
      { status: 502 },
    );
  }

  const snapshot = summariseProduct(product);

  // Increment use counter and set the cookie.
  uses.count += 1;
  cookieStore.set(RATE_COOKIE, JSON.stringify(uses), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: WINDOW_HOURS * 60 * 60,
  });

  return NextResponse.json({
    ok: true,
    title: snapshot.title,
    storeDomain: parsed.storeDomain,
    imageUrl: snapshot.imageUrl,
    currency,
    price: penceToDecimal(snapshot.price),
    available: snapshot.available,
    quantity: snapshot.quantity,
    description: snapshot.description,
    variantCount: product.variants.length,
    usesRemaining: MAX_PREVIEWS - uses.count,
  });
}
