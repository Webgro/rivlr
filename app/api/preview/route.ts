import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  parseShopifyUrl,
  fetchShopifyProduct,
  fetchShopifyCurrency,
  fetchShopifyProductMeta,
  normaliseShopifyTags,
  inferMarketFromDomain,
  scrapePdp,
  summariseProduct,
  penceToDecimal,
} from "@/lib/crawler/shopify";
import { probeVariantInventory } from "@/lib/crawler/cart-probe";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const RATE_COOKIE = "rivlr_preview_uses";
const MAX_PREVIEWS = 3;
const WINDOW_HOURS = 24;

/**
 * Public marketing-landing endpoint. The wow-factor moment for visitors:
 * paste a competitor URL → get back a rich intel card showing everything
 * Rivlr would surface inside the app.
 *
 * Pipeline (all in parallel for ~2s wall time):
 *   1. /products/{handle}.js          — price, variants, compare-at, description
 *   2. /products/{handle}.json        — vendor, type, tags, created date, images
 *   3. /products/{handle} HTML scrape — JSON-LD gtin/mpn/brand/reviews
 *   4. /cart.js                       — currency confirmation
 *   5. /cart/add.js probe (1 variant) — exact inventory when hidden
 *
 * Rate limit: cookie-based, 3 previews per browser per 24h. Not crypto-
 * grade (cookies clear), sufficient deterrent for casual abuse. Server-
 * side IP rate limit can be added later via Upstash if needed.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { url?: string }
    | null;
  const rawUrl = body?.url?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

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

  // Rate limit check.
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

  // Infer market from TLD so currency + price come back native (.ie → EUR etc).
  const market = inferMarketFromDomain(parsed.storeDomain);

  // Fan out the four heavy fetches in parallel — wall time = slowest, not sum.
  const [productResult, metaResult, pdpResult, currencyResult] =
    await Promise.allSettled([
      fetchShopifyProduct(parsed.productJsUrl, market),
      fetchShopifyProductMeta(parsed.storeDomain, parsed.handle, market),
      scrapePdp(parsed.storeDomain, parsed.handle, market),
      fetchShopifyCurrency(parsed.storeDomain, market),
    ]);

  if (productResult.status !== "fulfilled") {
    return NextResponse.json(
      {
        error:
          productResult.reason instanceof Error
            ? `Couldn't fetch this product: ${productResult.reason.message}`
            : "Couldn't fetch this product",
        kind: "fetch-failed",
      },
      { status: 502 },
    );
  }

  const product = productResult.value;
  const snapshot = summariseProduct(product);
  const meta = metaResult.status === "fulfilled" ? metaResult.value : null;
  const pdp = pdpResult.status === "fulfilled" ? pdpResult.value : null;
  const currency =
    currencyResult.status === "fulfilled" ? currencyResult.value : market.currency;

  // Inventory probe: if .js didn't expose quantity AND the product is
  // available, probe the first variant via /cart/add.js. One request per
  // preview, bounded by the cookie rate limit. Skip when probing is
  // pointless (already have a number, or product is sold out).
  let probedQuantity: number | null = null;
  let probedVariantTitle: string | null = null;
  if (
    snapshot.quantity === null &&
    snapshot.available &&
    product.variants.length > 0
  ) {
    const firstVariant = product.variants[0];
    try {
      const probe = await probeVariantInventory(
        parsed.storeDomain,
        firstVariant.id,
        market,
      );
      if (probe.kind === "exact") {
        probedQuantity = probe.quantity;
        probedVariantTitle = firstVariant.title;
      }
    } catch {
      // best effort — silent failure leaves probedQuantity null
    }
  }

  // Compare-at: shows discount % when on sale.
  const compareAt =
    typeof product.compare_at_price === "number" && product.compare_at_price > 0
      ? penceToDecimal(product.compare_at_price)
      : null;

  // Pull demand signals from shopify_tags.
  const shopifyTags = meta?.tags
    ? normaliseShopifyTags(meta.tags)
    : [];
  const isBestseller = shopifyTags.some((t) =>
    /^(?:bestseller|best-seller|best\s*seller|featured|top-seller)$/i.test(t),
  );

  // Increment use counter and persist.
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
    // Core
    title: snapshot.title,
    storeDomain: parsed.storeDomain,
    imageUrl: snapshot.imageUrl,
    currency,
    price: penceToDecimal(snapshot.price),
    compareAtPrice: compareAt,
    available: snapshot.available,
    quantity: snapshot.quantity,
    probedQuantity,
    probedVariantTitle,
    description: snapshot.description,
    variantCount: product.variants.length,
    // Tier 1 — meta JSON
    vendor: meta?.vendor ?? null,
    productType: meta?.product_type ?? null,
    shopifyTags,
    isBestseller,
    createdAt: meta?.created_at ?? null,
    imageCount: Array.isArray(meta?.images) ? meta.images.length : null,
    // Tier 2 — PDP JSON-LD
    gtin: pdp?.gtin ?? null,
    mpn: pdp?.mpn ?? null,
    brand: pdp?.brand ?? null,
    reviewCount: pdp?.reviewCount ?? null,
    reviewScore: pdp?.reviewScore ?? null,
    socialProofWidget: pdp?.socialProofWidget ?? null,
    // Market routing diagnostic
    marketCountry: market.country,
    // Rate-limit
    usesRemaining: MAX_PREVIEWS - uses.count,
  });
}
