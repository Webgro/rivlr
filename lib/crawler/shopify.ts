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
  price: string | number;
  available: boolean;
  sku: string | null;
  /** Set when the store has Shopify-managed inventory and exposes qty in .js. */
  inventory_quantity?: number;
  inventory_management?: string | null;
  inventory_policy?: string;
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

export interface ShopifyCart {
  token: string;
  currency: string;
}

/**
 * The crawler's view of a single product crawl — derived from the raw
 * Shopify response with the bits we actually want to store.
 */
export interface ProductSnapshot {
  title: string;
  imageUrl: string | null;
  price: number; // pence
  available: boolean;
  /** Sum of inventory_quantity across managed variants. NULL if unavailable. */
  quantity: number | null;
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

const RIVLR_USER_AGENT =
  "Mozilla/5.0 (compatible; RivlrBot/1.0; +https://rivlr.app/bot)";

export async function fetchShopifyProduct(
  productJsUrl: string,
): Promise<ShopifyProduct> {
  const res = await fetch(productJsUrl, {
    headers: {
      "User-Agent": RIVLR_USER_AGENT,
      Accept: "application/json",
    },
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
 * Fetches /cart.js to get the store's currency. Every Shopify store exposes
 * this endpoint — it returns at minimum `{ currency: "GBP" | "USD" | ... }`.
 */
export async function fetchShopifyCurrency(
  storeDomain: string,
): Promise<string> {
  const res = await fetch(`https://${storeDomain}/cart.js`, {
    headers: {
      "User-Agent": RIVLR_USER_AGENT,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return "GBP"; // sensible default
  const data = (await res.json()) as Partial<ShopifyCart>;
  return (data.currency ?? "GBP").toUpperCase();
}

/**
 * Reduces the raw Shopify product to a snapshot suitable for storage.
 * Computes total inventory quantity if the store exposes it.
 */
export function summariseProduct(product: ShopifyProduct): ProductSnapshot {
  // Only sum quantities when at least one variant has both managed inventory
  // AND a numeric quantity. Otherwise the field is meaningless.
  let quantity: number | null = null;
  let foundManagedQty = false;
  let total = 0;
  for (const v of product.variants) {
    if (
      v.inventory_management === "shopify" &&
      typeof v.inventory_quantity === "number"
    ) {
      foundManagedQty = true;
      total += v.inventory_quantity;
    }
  }
  if (foundManagedQty) quantity = total;

  return {
    title: product.title,
    imageUrl: product.featured_image,
    price: product.price,
    available: product.available,
    quantity,
  };
}

/**
 * Shopify prices are in pence (e.g. 8900 = £89.00). Convert to a decimal
 * string with 2dp for storage in the numeric column.
 */
export function penceToDecimal(pence: number): string {
  return (pence / 100).toFixed(2);
}
