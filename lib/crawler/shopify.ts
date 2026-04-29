/**
 * Shopify product fetcher.
 *
 * Uses the public `/products/{handle}.js` endpoint that every Shopify theme
 * relies on — this is essentially how product embeds and PWAs read product
 * data. Low risk for bot detection.
 *
 * Phase 1 reads price + availability only. Inventory-quantity scraping via
 * `/cart/add.js` is deferred to a later opt-in feature.
 */

export interface ShopifyVariant {
  id: number;
  title: string;
  price: string; // shopify returns price as string in pence/cents
  available: boolean;
  sku: string | null;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  available: boolean;
  price: number; // pence
  price_min: number;
  price_max: number;
  compare_at_price: number | null;
  featured_image: string | null;
  variants: ShopifyVariant[];
}

export interface ParsedShopifyUrl {
  storeDomain: string;
  handle: string;
  productJsUrl: string;
}

/**
 * Parses a Shopify product URL into the bits we need.
 * Accepts: https://store.com/products/handle, with or without trailing slash,
 * with collection prefix or query string.
 */
export function parseShopifyUrl(input: string): ParsedShopifyUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  // Match /products/<handle> or /collections/<x>/products/<handle>
  const match = url.pathname.match(/\/products\/([a-z0-9][a-z0-9-]*)/i);
  if (!match) return null;

  const handle = match[1].toLowerCase();
  const storeDomain = url.hostname.toLowerCase();
  const productJsUrl = `https://${storeDomain}/products/${handle}.js`;

  return { storeDomain, handle, productJsUrl };
}

export async function fetchShopifyProduct(
  productJsUrl: string,
): Promise<ShopifyProduct> {
  const res = await fetch(productJsUrl, {
    headers: {
      // Realistic UA — don't impersonate Googlebot.
      "User-Agent":
        "Mozilla/5.0 (compatible; RivlrBot/1.0; +https://rivlr.app/bot)",
      Accept: "application/json",
    },
    // Don't cache crawl responses — we want fresh data each time.
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Shopify fetch failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as ShopifyProduct;
  if (!data || typeof data.id !== "number") {
    throw new Error("Shopify response missing required fields");
  }
  return data;
}

/**
 * Shopify prices are in pence (e.g. 8900 = £89.00). Convert to a decimal
 * string with 2dp for storage in the numeric column.
 */
export function penceToDecimal(pence: number): string {
  return (pence / 100).toFixed(2);
}
