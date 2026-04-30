import { NextResponse } from "next/server";
import {
  parseShopifyUrl,
  fetchShopifyProduct,
  fetchShopifyCurrency,
  summariseProduct,
  penceToDecimal,
} from "@/lib/crawler/shopify";

export const dynamic = "force-dynamic";

/**
 * Public endpoint used by the marketing landing's live-demo widget.
 * Takes a Shopify product URL, fetches it once, returns enough data to
 * render the demo card. No auth — anyone can hit this.
 *
 * Rate-limiting: not implemented for v1. If abuse becomes an issue add
 * an IP-based limit (5 requests/hour) via a small Postgres counter or
 * Upstash Ratelimit.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { url?: string }
    | null;
  const rawUrl = body?.url?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  const parsed = parseShopifyUrl(rawUrl);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Doesn't look like a Shopify product URL. Try https://store.com/products/handle.",
      },
      { status: 400 },
    );
  }

  let currency = "GBP";
  try {
    currency = await fetchShopifyCurrency(parsed.storeDomain);
  } catch {
    // ignore — fall back to GBP for the demo display
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
      },
      { status: 502 },
    );
  }

  const snapshot = summariseProduct(product);

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
  });
}
