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
    // Shopify's storefront `/collections/{handle}/products.json` returns
    // images in TWO different shapes depending on the Shopify version /
    // theme: a flat array of URL strings (most common on the public
    // storefront), OR an array of objects with `src` (Admin API legacy).
    // It also reliably exposes `featured_image` as a URL string at the
    // product level. We try all three so we get the CDN URL whichever
    // shape this store uses.
    const data = (await res.json()) as {
      products: Array<{
        handle: string;
        title: string;
        featured_image?: string | null;
        images?: Array<string | { src?: string }>;
      }>;
    };
    if (!data.products || data.products.length === 0) break;
    results.push(
      ...data.products.map((p) => ({
        handle: p.handle,
        title: p.title,
        imageUrl: pickProductImage(p),
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

/**
 * Pick a CDN image URL from a Shopify product object — handles all three
 * shapes the various endpoints emit:
 *   1. featured_image: "https://cdn.shopify.com/..."  (storefront)
 *   2. images: ["https://...", ...]                   (storefront, modern)
 *   3. images: [{src: "https://..."}, ...]            (admin / legacy)
 *
 * Returns null when none of them yield a URL. We never proxy or
 * locally-host images — the CDN URL is what gets persisted and rendered.
 */
export function pickProductImage(p: {
  featured_image?: string | null;
  images?: Array<string | { src?: string } | undefined> | null;
}): string | null {
  if (typeof p.featured_image === "string" && p.featured_image.length > 0) {
    return p.featured_image;
  }
  if (Array.isArray(p.images)) {
    for (const img of p.images) {
      if (typeof img === "string" && img.length > 0) return img;
      if (img && typeof img === "object" && typeof img.src === "string") {
        return img.src;
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
// Tier 1: /products/{handle}.json meta fetch
// ─────────────────────────────────────────────────────────────────────

/** The product fields exposed by /products/{handle}.json (richer than .js).
 *  We don't model variants here because we already get them from .js.
 *
 *  NOTE: `tags` ships as either an array (newer storefront API) OR a
 *  comma-separated string (older themes / admin API legacy). Normalise via
 *  `normaliseShopifyTags` below before storing. */
export interface ShopifyProductMeta {
  vendor?: string | null;
  product_type?: string | null;
  tags?: string[] | string;
  created_at?: string;
  updated_at?: string;
  images?: Array<{ src?: string }>;
}

/** Normalise `tags` from /products/{handle}.json which can be either an
 *  array or a comma-separated string. Returns a clean lowercase-trimmed
 *  array, deduped. */
export function normaliseShopifyTags(input: unknown): string[] {
  if (!input) return [];
  let parts: string[];
  if (Array.isArray(input)) {
    parts = input.map((s) => String(s));
  } else if (typeof input === "string") {
    parts = input.split(",");
  } else {
    return [];
  }
  const cleaned = parts.map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set(cleaned));
}

/**
 * Hits `/products/{handle}.json` for richer product fields not in `.js`:
 * vendor, product_type, tags array, created_at, updated_at, image count.
 *
 * We only call this when last_meta_crawled_at > 24h, so the request volume
 * is at most 1 per product per day on top of hourly .js crawls.
 */
export async function fetchShopifyProductMeta(
  storeDomain: string,
  handle: string,
): Promise<ShopifyProductMeta | null> {
  const url = `https://${storeDomain}/products/${handle}.json`;
  try {
    const res = await fetch(url, { headers: RIVLR_HEADERS, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { product?: ShopifyProductMeta };
    return data.product ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// Tier 2: PDP scraper for JSON-LD + review widgets
// ─────────────────────────────────────────────────────────────────────

export interface PdpScrape {
  gtin: string | null;
  mpn: string | null;
  brand: string | null;
  reviewCount: number | null;
  reviewScore: number | null;
  priceValidUntil: Date | null;
  socialProofWidget: string | null;
}

/**
 * Fetches the full PDP HTML and extracts:
 *  - JSON-LD Product schemas (gtin, mpn, brand, aggregateRating, offers)
 *  - Loox / Judge.me / Yotpo review-widget data
 *  - Social-proof FOMO app signatures (SalesPop, Fomo, etc.)
 *
 * No DOM parser — uses regex extraction to keep this dependency-free and
 * fast. It's brittle by nature, so every field is independently nullable.
 */
export async function scrapePdp(
  storeDomain: string,
  handle: string,
): Promise<PdpScrape | null> {
  const url = `https://${storeDomain}/products/${handle}`;
  let html: string;
  try {
    const res = await fetch(url, {
      headers: { ...RIVLR_HEADERS, Accept: "text/html" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const result: PdpScrape = {
    gtin: null,
    mpn: null,
    brand: null,
    reviewCount: null,
    reviewScore: null,
    priceValidUntil: null,
    socialProofWidget: null,
  };

  // Extract every JSON-LD block, look for Product schemas.
  const jsonLdMatches = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const m of jsonLdMatches) {
    const raw = m[1].trim();
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // some themes emit partial / templated JSON
    }
    // Schema can be a single object, array, or @graph wrapper.
    const candidates: unknown[] = Array.isArray(parsed)
      ? parsed
      : (parsed as { "@graph"?: unknown[] })?.["@graph"]
        ? (parsed as { "@graph": unknown[] })["@graph"]
        : [parsed];

    for (const c of candidates) {
      if (!c || typeof c !== "object") continue;
      const obj = c as Record<string, unknown>;
      const type = obj["@type"];
      const isProduct =
        type === "Product" ||
        (Array.isArray(type) && type.includes("Product"));
      if (!isProduct) continue;

      // gtin / mpn / brand
      const gtin =
        (obj.gtin13 as string | undefined) ??
        (obj.gtin12 as string | undefined) ??
        (obj.gtin8 as string | undefined) ??
        (obj.gtin as string | undefined) ??
        null;
      if (gtin && typeof gtin === "string") result.gtin = gtin.trim();

      if (typeof obj.mpn === "string") result.mpn = obj.mpn.trim();

      const brand = obj.brand;
      if (typeof brand === "string") {
        result.brand = brand.trim();
      } else if (brand && typeof brand === "object") {
        const bn = (brand as { name?: string }).name;
        if (typeof bn === "string") result.brand = bn.trim();
      }

      // aggregateRating
      const rating = obj.aggregateRating;
      if (rating && typeof rating === "object") {
        const r = rating as Record<string, unknown>;
        const rc = r.reviewCount ?? r.ratingCount;
        const rv = r.ratingValue;
        if (typeof rc === "number") result.reviewCount = rc;
        else if (typeof rc === "string" && /^\d+$/.test(rc))
          result.reviewCount = parseInt(rc, 10);
        if (typeof rv === "number") result.reviewScore = rv;
        else if (typeof rv === "string" && !isNaN(parseFloat(rv)))
          result.reviewScore = parseFloat(rv);
      }

      // offers.priceValidUntil — array or single
      const offers = obj.offers;
      const offerArr = Array.isArray(offers) ? offers : offers ? [offers] : [];
      for (const o of offerArr) {
        if (!o || typeof o !== "object") continue;
        const pvu = (o as { priceValidUntil?: string }).priceValidUntil;
        if (typeof pvu === "string") {
          const d = new Date(pvu);
          if (!isNaN(d.getTime())) {
            result.priceValidUntil = d;
            break;
          }
        }
      }
    }
  }

  // Loox widget data (data-rating, data-count attrs on review element).
  if (result.reviewCount === null || result.reviewScore === null) {
    const looxMatch = html.match(
      /class=["'][^"']*loox-rating[^"']*["'][^>]*data-rating=["']([\d.]+)["'][^>]*data-count=["'](\d+)["']/i,
    );
    if (looxMatch) {
      if (result.reviewScore === null) result.reviewScore = parseFloat(looxMatch[1]);
      if (result.reviewCount === null) result.reviewCount = parseInt(looxMatch[2], 10);
    }
  }

  // Judge.me (jdgm-prev-badge data-number-of-reviews, data-average-rating).
  if (result.reviewCount === null || result.reviewScore === null) {
    const jdgmCount = html.match(
      /data-number-of-reviews=["'](\d+)["']/i,
    );
    const jdgmScore = html.match(
      /data-average-rating=["']([\d.]+)["']/i,
    );
    if (jdgmCount && result.reviewCount === null)
      result.reviewCount = parseInt(jdgmCount[1], 10);
    if (jdgmScore && result.reviewScore === null)
      result.reviewScore = parseFloat(jdgmScore[1]);
  }

  // Social-proof FOMO widget detection — by script src patterns.
  const widgetSignatures: Array<[RegExp, string]> = [
    [/salespop\./i, "salespop"],
    [/fomo\.com\//i, "fomo"],
    [/proofkit\./i, "proofkit"],
    [/(?:beeketing|nextsale)\./i, "beeketing"],
    [/sales-?notification/i, "generic-fomo"],
  ];
  for (const [re, slug] of widgetSignatures) {
    if (re.test(html)) {
      result.socialProofWidget = slug;
      break;
    }
  }

  return result;
}
