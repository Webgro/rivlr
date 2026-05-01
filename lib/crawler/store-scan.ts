import { db, schema } from "@/lib/db";
import { sql, eq } from "drizzle-orm";

/**
 * Daily store-level scanner — populates the `stores` and `store_snapshots`
 * tables from publicly-available endpoints on each Shopify store the user
 * already has at least one tracked product on.
 *
 * Fetches per store:
 *  - Storefront `/` HTML — theme, Plus signals, app fingerprints, free
 *    shipping threshold, currency.
 *  - `/products.json?limit=250&page=N` — total catalogue size (counted, not
 *    persisted as products; that's the discover cron's job).
 *  - `/collections.json` — count of public collections.
 *  - `/blogs.json` — count of public blogs.
 *
 * Conservative request budget: ~5 requests per store per day. Cheap.
 *
 * Stockout-rate is computed from our existing tracked_products + the latest
 * stock_observations — no extra crawl needed for that piece.
 */

const RIVLR_USER_AGENT =
  "Mozilla/5.0 (compatible; RivlrBot/1.0; +https://rivlr.app/bot)";
const HEADERS_JSON: HeadersInit = {
  "User-Agent": RIVLR_USER_AGENT,
  Accept: "application/json",
  "Accept-Language": "en-GB,en;q=0.9",
  Cookie: "localization=GB; cart_currency=GBP",
};
const HEADERS_HTML: HeadersInit = {
  "User-Agent": RIVLR_USER_AGENT,
  Accept: "text/html",
  "Accept-Language": "en-GB,en;q=0.9",
  Cookie: "localization=GB; cart_currency=GBP",
};

/** Known third-party Shopify apps / SaaS, identified by script-src patterns
 *  in storefront HTML. Order matters — first match wins for each kind. */
const APP_SIGNATURES: Array<{
  re: RegExp;
  slug: string;
  name: string;
  kind: string;
}> = [
  // Email / marketing
  { re: /klaviyo\.com/i, slug: "klaviyo", name: "Klaviyo", kind: "email" },
  { re: /omnisend\.com/i, slug: "omnisend", name: "Omnisend", kind: "email" },
  { re: /mailchimp\.com/i, slug: "mailchimp", name: "Mailchimp", kind: "email" },
  { re: /mailerlite\.com/i, slug: "mailerlite", name: "MailerLite", kind: "email" },
  // Reviews
  { re: /loox\.io/i, slug: "loox", name: "Loox", kind: "reviews" },
  { re: /judge\.me/i, slug: "judgeme", name: "Judge.me", kind: "reviews" },
  { re: /yotpo\.com/i, slug: "yotpo", name: "Yotpo", kind: "reviews" },
  { re: /okendo\.io/i, slug: "okendo", name: "Okendo", kind: "reviews" },
  { re: /stamped\.io/i, slug: "stamped", name: "Stamped.io", kind: "reviews" },
  { re: /reviews\.io/i, slug: "reviewsio", name: "Reviews.io", kind: "reviews" },
  { re: /trustpilot\./i, slug: "trustpilot", name: "Trustpilot", kind: "reviews" },
  // Subscriptions
  { re: /rechargepayments\.com|recharge\.com/i, slug: "recharge", name: "Recharge", kind: "subscriptions" },
  { re: /bold(?:apps|subscriptions)/i, slug: "bold-subscriptions", name: "Bold Subscriptions", kind: "subscriptions" },
  { re: /seal\-?subscriptions/i, slug: "seal", name: "Seal Subscriptions", kind: "subscriptions" },
  { re: /skio\.com/i, slug: "skio", name: "Skio", kind: "subscriptions" },
  // Popups / FOMO
  { re: /privy\.com/i, slug: "privy", name: "Privy", kind: "popups" },
  { re: /justuno\.com/i, slug: "justuno", name: "Justuno", kind: "popups" },
  { re: /optinmonster\.com/i, slug: "optinmonster", name: "OptinMonster", kind: "popups" },
  { re: /salespop\./i, slug: "salespop", name: "Sales Pop", kind: "fomo" },
  { re: /fomo\.com\//i, slug: "fomo", name: "Fomo", kind: "fomo" },
  // Customer support
  { re: /gorgias\.com|gorgias\.chat/i, slug: "gorgias", name: "Gorgias", kind: "support" },
  { re: /intercom\.io|intercom\.com|intercomcdn/i, slug: "intercom", name: "Intercom", kind: "support" },
  { re: /tidio\.co/i, slug: "tidio", name: "Tidio", kind: "support" },
  { re: /zendesk\./i, slug: "zendesk", name: "Zendesk", kind: "support" },
  { re: /tawk\.to/i, slug: "tawk", name: "Tawk.to", kind: "support" },
  { re: /re:?amaze/i, slug: "reamaze", name: "Re:amaze", kind: "support" },
  // Search / merchandising
  { re: /searchanise\./i, slug: "searchanise", name: "Searchanise", kind: "search" },
  { re: /algolia\./i, slug: "algolia", name: "Algolia", kind: "search" },
  { re: /klevu\./i, slug: "klevu", name: "Klevu", kind: "search" },
  { re: /searchspring\./i, slug: "searchspring", name: "Searchspring", kind: "search" },
  // Analytics / pixels
  { re: /hotjar\./i, slug: "hotjar", name: "Hotjar", kind: "analytics" },
  { re: /mixpanel\./i, slug: "mixpanel", name: "Mixpanel", kind: "analytics" },
  { re: /segment\.com/i, slug: "segment", name: "Segment", kind: "analytics" },
  { re: /pinterest\.com\/v3\//i, slug: "pinterest-pixel", name: "Pinterest Pixel", kind: "analytics" },
  { re: /tiktok\.com\/i\d+\/pixel/i, slug: "tiktok-pixel", name: "TikTok Pixel", kind: "analytics" },
  // Bundles / upsells
  { re: /rebuy\.io/i, slug: "rebuy", name: "Rebuy", kind: "upsells" },
  { re: /bold-?bundles/i, slug: "bold-bundles", name: "Bold Bundles", kind: "upsells" },
  // Shipping / delivery promises
  { re: /shippingbar\./i, slug: "shippingbar", name: "Shipping Bar", kind: "shipping" },
  { re: /aftership\./i, slug: "aftership", name: "AfterShip", kind: "tracking" },
];

interface StoreScanResult {
  domain: string;
  apps: Array<{ slug: string; name: string; kind: string }>;
  themeName: string | null;
  themeStoreId: string | null;
  isShopifyPlus: boolean;
  platformCurrency: string | null;
  marketsCount: number | null;
  freeShippingThreshold: number | null;
  freeShippingCurrency: string | null;
  totalProductCount: number | null;
  collectionsCount: number | null;
  blogsCount: number | null;
}

async function scanStorefrontHtml(domain: string): Promise<{
  apps: Array<{ slug: string; name: string; kind: string }>;
  themeName: string | null;
  themeStoreId: string | null;
  isShopifyPlus: boolean;
  platformCurrency: string | null;
  marketsCount: number | null;
  freeShippingThreshold: number | null;
  freeShippingCurrency: string | null;
}> {
  const empty = {
    apps: [],
    themeName: null,
    themeStoreId: null,
    isShopifyPlus: false,
    platformCurrency: null,
    marketsCount: null,
    freeShippingThreshold: null,
    freeShippingCurrency: null,
  };
  let html: string;
  try {
    const res = await fetch(`https://${domain}/`, {
      headers: HEADERS_HTML,
      cache: "no-store",
    });
    if (!res.ok) return empty;
    html = await res.text();
  } catch {
    return empty;
  }

  // App detection — dedupe by slug.
  const seen = new Set<string>();
  const apps: Array<{ slug: string; name: string; kind: string }> = [];
  for (const sig of APP_SIGNATURES) {
    if (sig.re.test(html) && !seen.has(sig.slug)) {
      seen.add(sig.slug);
      apps.push({ slug: sig.slug, name: sig.name, kind: sig.kind });
    }
  }

  // Theme: most Shopify themes inject Shopify.theme = { id, name, role, ... }.
  let themeName: string | null = null;
  let themeStoreId: string | null = null;
  const themeMatch = html.match(/Shopify\.theme\s*=\s*(\{[^}]+\})/);
  if (themeMatch) {
    const block = themeMatch[1];
    const nm = block.match(/"name"\s*:\s*"([^"]+)"/);
    const id = block.match(/"theme_store_id"\s*:\s*(\d+|null)/);
    if (nm) themeName = nm[1];
    if (id && id[1] !== "null") themeStoreId = id[1];
  }

  // Plus signals: oxygen-v2 CDN, Shopify.Plus object, /apps/checkout/.
  const isShopifyPlus =
    /cdn\.shopify\.com\/oxygen-v2/i.test(html) ||
    /Shopify\.Plus\b/.test(html) ||
    /shop\.oxygen-v2\./i.test(html);

  // Currency: window.Shopify.currency = { active: "GBP", ... }
  let platformCurrency: string | null = null;
  const curMatch = html.match(
    /Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/,
  );
  if (curMatch) platformCurrency = curMatch[1];

  // Markets count: Shopify.routes.locale_url_prefixes or hreflang alternates.
  const hreflangs = html.match(/<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["']/gi);
  const marketsCount = hreflangs ? new Set(
    hreflangs
      .map((h) => h.match(/hreflang=["']([^"']+)["']/i)?.[1])
      .filter(Boolean),
  ).size : null;

  // Free shipping threshold heuristic. Looks for currency-followed-by-number
  // near words "free shipping" / "free delivery". Limited but useful.
  let freeShippingThreshold: number | null = null;
  let freeShippingCurrency: string | null = null;
  const ctxMatches = html.matchAll(
    /(?:free\s+(?:shipping|delivery)[^<\n]{0,80}|spend[^<\n]{0,40})(?:over\s+|above\s+|on\s+orders?\s+over\s+|^|\s)(£|\$|€)\s?(\d{1,4}(?:[.,]\d{2})?)/gi,
  );
  for (const m of ctxMatches) {
    const symbol = m[1];
    const value = parseFloat(m[2].replace(",", "."));
    if (!isNaN(value) && value > 5 && value < 1000) {
      freeShippingThreshold = value;
      freeShippingCurrency =
        symbol === "£" ? "GBP" : symbol === "€" ? "EUR" : "USD";
      break;
    }
  }

  return {
    apps,
    themeName,
    themeStoreId,
    isShopifyPlus,
    platformCurrency,
    marketsCount,
    freeShippingThreshold,
    freeShippingCurrency,
  };
}

async function fetchTotalProducts(domain: string): Promise<number | null> {
  // Paginate /products.json until empty. Cap at 20 pages × 250 = 5,000 to
  // avoid huge stores eating our budget.
  const PER_PAGE = 250;
  const MAX_PAGES = 20;
  let total = 0;
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const res = await fetch(
        `https://${domain}/products.json?limit=${PER_PAGE}&page=${page}`,
        { headers: HEADERS_JSON, cache: "no-store" },
      );
      if (!res.ok) return total > 0 ? total : null;
      const data = (await res.json()) as { products?: unknown[] };
      const products = data.products ?? [];
      total += products.length;
      if (products.length < PER_PAGE) break;
      // Be polite between pages.
      await new Promise((r) => setTimeout(r, 750));
    } catch {
      return total > 0 ? total : null;
    }
  }
  return total;
}

async function fetchCollectionsCount(domain: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://${domain}/collections.json?limit=250`,
      { headers: HEADERS_JSON, cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { collections?: unknown[] };
    return data.collections?.length ?? null;
  } catch {
    return null;
  }
}

async function fetchBlogsCount(domain: string): Promise<number | null> {
  try {
    const res = await fetch(`https://${domain}/blogs.json`, {
      headers: HEADERS_JSON,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { blogs?: unknown[] };
    return data.blogs?.length ?? null;
  } catch {
    return null;
  }
}

function inferDisplayName(domain: string): string {
  // "uk.gymshark.com" -> "gymshark" -> "Gymshark"
  // "store.example.co.uk" -> "example"
  const parts = domain.split(".");
  // Find the longest meaningful subdomain part (skip "www", short locale prefixes).
  const meaningful = parts.find(
    (p) => p.length > 2 && p !== "www" && p !== "shop" && p !== "store" && p !== "co",
  );
  const root = meaningful ?? parts[0];
  return root.charAt(0).toUpperCase() + root.slice(1);
}

async function scanOneStore(domain: string): Promise<StoreScanResult> {
  const [storefront, totalProductCount, collectionsCount, blogsCount] =
    await Promise.all([
      scanStorefrontHtml(domain),
      fetchTotalProducts(domain),
      fetchCollectionsCount(domain),
      fetchBlogsCount(domain),
    ]);

  return {
    domain,
    ...storefront,
    totalProductCount,
    collectionsCount,
    blogsCount,
  };
}

async function computeOutOfStockCount(domain: string): Promise<number> {
  // Latest stock observation per product, count where available = false.
  const [row] = await db.execute<{ out_count: number }>(sql`
    SELECT COUNT(*)::int AS out_count
    FROM tracked_products tp
    JOIN LATERAL (
      SELECT available FROM stock_observations
      WHERE product_id = tp.id ORDER BY observed_at DESC LIMIT 1
    ) so ON true
    WHERE tp.store_domain = ${domain}
      AND tp.active = true
      AND so.available = false
  `);
  return row?.out_count ?? 0;
}

async function newProductsLast24h(domain: string): Promise<number> {
  const [row] = await db.execute<{ c: number }>(sql`
    SELECT COUNT(*)::int AS c
    FROM discovered_products
    WHERE store_domain = ${domain}
      AND first_seen >= NOW() - INTERVAL '24 hours'
  `);
  return row?.c ?? 0;
}

/**
 * Main entry point — scans every distinct store_domain that has at least
 * one active tracked product, persists results into `stores` + appends to
 * `store_snapshots`. Sequential per-store with a 1.5s gap to be polite.
 */
export async function scanAllStores(): Promise<{
  scanned: number;
  ok: number;
  failed: number;
}> {
  const rows = await db.execute<{ domain: string }>(sql`
    SELECT DISTINCT store_domain AS domain
    FROM tracked_products
    WHERE active = true
  `);
  const domains = Array.from(rows).map((r) => r.domain);

  let ok = 0;
  let failed = 0;
  for (const domain of domains) {
    try {
      const result = await scanOneStore(domain);
      const outOfStockCount = await computeOutOfStockCount(domain);
      const last24 = await newProductsLast24h(domain);

      // Upsert into stores.
      await db
        .insert(schema.stores)
        .values({
          domain: result.domain,
          displayName: inferDisplayName(domain),
          lastScannedAt: new Date(),
          totalProductCount: result.totalProductCount,
          outOfStockCount,
          themeName: result.themeName,
          themeStoreId: result.themeStoreId,
          isShopifyPlus: result.isShopifyPlus,
          platformCurrency: result.platformCurrency,
          marketsCount: result.marketsCount,
          appsDetected: result.apps,
          freeShippingThreshold:
            result.freeShippingThreshold !== null
              ? result.freeShippingThreshold.toFixed(2)
              : null,
          freeShippingCurrency: result.freeShippingCurrency,
          collectionsCount: result.collectionsCount,
          blogsCount: result.blogsCount,
        })
        .onConflictDoUpdate({
          target: schema.stores.domain,
          set: {
            displayName: inferDisplayName(domain),
            lastScannedAt: new Date(),
            totalProductCount: result.totalProductCount,
            outOfStockCount,
            themeName: result.themeName,
            themeStoreId: result.themeStoreId,
            isShopifyPlus: result.isShopifyPlus,
            platformCurrency: result.platformCurrency,
            marketsCount: result.marketsCount,
            appsDetected: result.apps,
            freeShippingThreshold:
              result.freeShippingThreshold !== null
                ? result.freeShippingThreshold.toFixed(2)
                : null,
            freeShippingCurrency: result.freeShippingCurrency,
            collectionsCount: result.collectionsCount,
            blogsCount: result.blogsCount,
          },
        });

      // Append a snapshot row for time-series.
      await db.insert(schema.storeSnapshots).values({
        storeDomain: domain,
        totalProductCount: result.totalProductCount,
        outOfStockCount,
        newProductsLast24h: last24,
        appsCount: result.apps.length,
      });

      // Best-seller probe: only meaningful for the user's own store. Cheap
      // when skipped (one column lookup), so safe to gate inside the loop.
      const [own] = await db
        .select({ isMine: schema.stores.isMyStore })
        .from(schema.stores)
        .where(eq(schema.stores.domain, domain))
        .limit(1);
      if (own?.isMine) {
        try {
          await scanBestsellerCollections(domain);
        } catch {
          // best-effort
        }
      }

      ok++;
    } catch (err) {
      console.error("[store-scan] failed", domain, err);
      failed++;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  return { scanned: domains.length, ok, failed };
}

/** Common handles for "best sellers" / "featured" / "top products" type
 *  collections. Order matters — first hit wins per store. Most Shopify
 *  themes use one of these conventions. */
const BESTSELLER_COLLECTION_HANDLES = [
  "best-sellers",
  "bestsellers",
  "best-selling",
  "best-sellers-1",
  "top-sellers",
  "top-selling",
  "top-products",
  "featured",
  "most-popular",
  "popular-products",
  "trending",
];

/**
 * Probe a store's catalogue for best-seller-type collections and mark any
 * tracked products on that store that appear inside them. Only run for
 * stores flagged is_my_store = true (no point on competitors — we don't
 * track every product on competitor stores so the signal isn't useful).
 *
 * Tries each candidate handle in order; first one that returns products
 * is treated as the best-seller list. Caps at 250 products per collection
 * to keep request volume bounded.
 */
export async function scanBestsellerCollections(domain: string): Promise<{
  matched: number;
  collectionUsed: string | null;
}> {
  let bestsellerHandles: Set<string> | null = null;
  let collectionUsed: string | null = null;

  for (const handle of BESTSELLER_COLLECTION_HANDLES) {
    try {
      const res = await fetch(
        `https://${domain}/collections/${handle}/products.json?limit=250`,
        { headers: HEADERS_JSON, cache: "no-store" },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        products?: Array<{ handle?: string }>;
      };
      const handles = (data.products ?? [])
        .map((p) => p.handle)
        .filter((h): h is string => typeof h === "string");
      if (handles.length === 0) continue;
      bestsellerHandles = new Set(handles);
      collectionUsed = handle;
      break;
    } catch {
      // try next
    }
  }

  if (!bestsellerHandles || bestsellerHandles.size === 0) {
    // Reset flags so a previously-flagged set isn't stuck if the merchant
    // removed the collection.
    await db
      .update(schema.trackedProducts)
      .set({ isBestseller: false })
      .where(eq(schema.trackedProducts.storeDomain, domain));
    return { matched: 0, collectionUsed: null };
  }

  // Update tracked_products: flag those whose handle is in the set, clear
  // the rest. Two SQL statements — cheap on a few hundred rows.
  const handleArray = Array.from(bestsellerHandles);
  await db.execute(sql`
    UPDATE tracked_products
       SET is_bestseller = true
     WHERE store_domain = ${domain}
       AND handle = ANY(${handleArray})
  `);
  await db.execute(sql`
    UPDATE tracked_products
       SET is_bestseller = false
     WHERE store_domain = ${domain}
       AND NOT (handle = ANY(${handleArray}))
  `);

  // Count how many of OUR tracked products were marked.
  const [row] = await db.execute<{ c: number }>(sql`
    SELECT COUNT(*)::int AS c FROM tracked_products
    WHERE store_domain = ${domain} AND is_bestseller = true
  `);
  return { matched: row?.c ?? 0, collectionUsed };
}

/** Used by the `/stores` UI as a fallback when a store hasn't been scanned
 *  yet. Run synchronously on first navigation if needed. Cheap. */
export async function scanStoreNow(domain: string) {
  const result = await scanOneStore(domain);
  const outOfStockCount = await computeOutOfStockCount(domain);
  await db
    .insert(schema.stores)
    .values({
      domain,
      displayName: inferDisplayName(domain),
      lastScannedAt: new Date(),
      totalProductCount: result.totalProductCount,
      outOfStockCount,
      themeName: result.themeName,
      themeStoreId: result.themeStoreId,
      isShopifyPlus: result.isShopifyPlus,
      platformCurrency: result.platformCurrency,
      marketsCount: result.marketsCount,
      appsDetected: result.apps,
      freeShippingThreshold:
        result.freeShippingThreshold !== null
          ? result.freeShippingThreshold.toFixed(2)
          : null,
      freeShippingCurrency: result.freeShippingCurrency,
      collectionsCount: result.collectionsCount,
      blogsCount: result.blogsCount,
    })
    .onConflictDoUpdate({
      target: schema.stores.domain,
      set: {
        lastScannedAt: new Date(),
        totalProductCount: result.totalProductCount,
        outOfStockCount,
        appsDetected: result.apps,
        themeName: result.themeName,
        isShopifyPlus: result.isShopifyPlus,
      },
    });
  // Suppress the unused-eq warning if the linter complains about above.
  void eq;
}
