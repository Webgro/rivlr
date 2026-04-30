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
  /** HTML description as the merchant wrote it. Often contains the product
   * specifications / details. Empty string when omitted. */
  description?: string;
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
  /** HTML description from Shopify, or null if absent. */
  description: string | null;
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

export interface ParsedShopifyCollectionUrl {
  storeDomain: string;
  handle: string;
}

/**
 * Parses a Shopify collection URL. Accepts:
 *  https://store.com/collections/dog-food
 *  https://store.com/collections/dog-food?page=2
 *  https://store.com/en-gb/collections/dog-food
 *
 * Note: a collection URL that ALSO has /products/x in it (e.g.
 * /collections/dog-food/products/widget) parses as a product URL via
 * parseShopifyUrl — try product parsing first.
 */
export function parseShopifyCollectionUrl(
  input: string,
): ParsedShopifyCollectionUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  // Reject if this is also a product URL — caller should use parseShopifyUrl.
  if (/\/products\/[a-z0-9-]+/i.test(url.pathname)) return null;

  // Match /collections/<handle> (with optional locale prefix).
  const match = url.pathname.match(
    /(?:^|\/)collections\/([a-z0-9][a-z0-9-]*)(?:\/|$|\?)/i,
  );
  if (!match) return null;

  const handle = match[1].toLowerCase();
  const storeDomain = url.hostname.toLowerCase();
  return { storeDomain, handle };
}

const RIVLR_USER_AGENT =
  "Mozilla/5.0 (compatible; RivlrBot/1.0; +https://rivlr.app/bot)";

/**
 * Headers forcing Shopify to route us to the UK / GBP market when a store
 * has Shopify Markets enabled. Without this, the same store can return
 * USD prices to one request and GBP to the next based on Shopify's geo
 * routing decisions for our (Vercel) IP. The two cookies plus
 * Accept-Language together cover the variants of how stores set the market.
 *
 * If we ever support multiple regions per user, this becomes configurable.
 */
const RIVLR_HEADERS: HeadersInit = {
  "User-Agent": RIVLR_USER_AGENT,
  Accept: "application/json",
  "Accept-Language": "en-GB,en;q=0.9",
  Cookie: "localization=GB; cart_currency=GBP",
};

export async function fetchShopifyProduct(
  productJsUrl: string,
): Promise<ShopifyProduct> {
  const res = await fetch(productJsUrl, {
    headers: RIVLR_HEADERS,
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
 * Fetches all products in a Shopify collection by paginating through the
 * /collections/{handle}/products.json endpoint. Returns the list of product
 * handles (which we turn into tracked URLs in the add flow).
 *
 * The endpoint is publicly available on every Shopify store and returns up
 * to 250 products per page. We cap at MAX_PAGES to avoid runaway adds — a
 * single collection of 5000+ items is rarely the right thing to bulk-track.
 *
 * Politeness: 1s delay between page fetches.
 */
export async function fetchShopifyCollection(
  storeDomain: string,
  handle: string,
  opts: { maxProducts?: number } = {},
): Promise<
  Array<{ handle: string; title: string; imageUrl: string | null }>
> {
  const { maxProducts = 1000 } = opts;
  const results: Array<{
    handle: string;
    title: string;
    imageUrl: string | null;
  }> = [];
  const PER_PAGE = 250;
  const MAX_PAGES = Math.ceil(maxProducts / PER_PAGE);

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://${storeDomain}/collections/${handle}/products.json?limit=${PER_PAGE}&page=${page}`;
    const res = await fetch(url, {
      headers: RIVLR_HEADERS,
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Collection fetch failed: ${res.status} ${res.statusText}`);
    }
    const data = (await res.json()) as {
      products: Array<{
        handle: string;
        title: string;
        images?: Array<{ src?: string }>;
      }>;
    };
    if (!data.products || data.products.length === 0) break;
    results.push(
      ...data.products.map((p) => ({
        handle: p.handle,
        title: p.title,
        imageUrl: p.images && p.images.length > 0 ? p.images[0].src ?? null : null,
      })),
    );
    if (data.products.length < PER_PAGE) break;
    if (results.length >= maxProducts) break;
    await new Promise((r) => setTimeout(r, 1000)); // polite delay
  }

  return results.slice(0, maxProducts);
}

/**
 * Fetches /cart.js to get the store's currency for THIS request's market.
 * Stores using Shopify Markets can return different currencies based on
 * geo / cookies — we send UK headers so this should consistently report
 * the GBP market when the store has one.
 */
export async function fetchShopifyCurrency(
  storeDomain: string,
): Promise<string> {
  const res = await fetch(`https://${storeDomain}/cart.js`, {
    headers: RIVLR_HEADERS,
    cache: "no-store",
  });
  if (!res.ok) return "GBP";
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
    description: product.description?.trim() || null,
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
