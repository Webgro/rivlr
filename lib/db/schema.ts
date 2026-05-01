import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Phase 1 schema — single-tenant (one shared password). Phase 2 introduces
 * `users` and adds `user_id` foreign keys; the migration assigns existing
 * data to the owner account.
 */

export const trackedProducts = pgTable(
  "tracked_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    url: text("url").notNull().unique(),
    handle: text("handle").notNull(), // shopify product handle
    storeDomain: text("store_domain").notNull(), // e.g. example.myshopify.com
    title: text("title"),
    imageUrl: text("image_url"),
    currency: text("currency").notNull().default("GBP"), // detected via /cart.js on first add
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    /** Email when stock changes (in→out or out→in). Phase 5 actually sends. */
    notifyStockChanges: boolean("notify_stock_changes").notNull().default(false),
    /** Email when price drops by any amount. Phase 5 actually sends. */
    notifyPriceDrops: boolean("notify_price_drops").notNull().default(false),
    /** User-defined labels for organising / filtering. Lowercase, simple text. */
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /**
     * Group this product belongs to (for linking same-item-different-store).
     * NULL = standalone. All products in a group share this id.
     */
    groupId: uuid("group_id"),
    /**
     * Latest variants snapshot from the most recent crawl. Stored as JSON
     * so we don't have to migrate the schema for new variant fields. We
     * intentionally don't keep variant history yet (future feature).
     * Shape: Array<{ id, title, price, available, quantity }>
     */
    variantsSnapshot: jsonb("variants_snapshot")
      .$type<
        Array<{
          id: string;
          title: string;
          price: number;
          available: boolean;
          quantity: number | null;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /**
     * Consecutive crawl failures. Reset to 0 on success, incremented on
     * failure. When this hits AUTO_PAUSE_THRESHOLD the crawler sets
     * `active = false` so dead URLs stop infinite-retrying.
     */
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    /**
     * Set when the product was auto-paused due to repeated crawl failures
     * (vs manually paused). Lets us show a different UI badge.
     */
    autoPausedAt: timestamp("auto_paused_at", { withTimezone: true }),
    /** Last error message recorded for this product, for diagnostics. */
    lastError: text("last_error"),
    /** Free-text user notes about the product (markdown-ish, no length cap). */
    notes: text("notes"),
    /**
     * Product description from the Shopify .js endpoint. HTML — usually the
     * spec / details content the merchant wrote. Updated on each crawl.
     * Useful for spotting changes the merchant made to copy or specs.
     */
    description: text("description"),

    // ─── Tier 1: richer fields from /products/{handle}.json ────────────
    /** Strike-through "was £X" price from compare_at_price. NULL when not on
     *  sale. Stored as numeric string (matches priceObservations.price). */
    compareAtPrice: numeric("compare_at_price", { precision: 12, scale: 2 }),
    /** Merchant-set Shopify tags (NOT user-set Rivlr tags above). E.g.
     *  "bestseller", "summer-2026". Reveals their internal merchandising. */
    shopifyTags: text("shopify_tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** The merchant's vendor/brand string (their categorisation of brand). */
    vendor: text("vendor"),
    /** The merchant's product type taxonomy entry. */
    productType: text("product_type"),
    /** When the merchant first created this product on Shopify. */
    shopifyCreatedAt: timestamp("shopify_created_at", { withTimezone: true }),
    /** When the merchant last updated this product on Shopify. Strong
     *  freshness signal — correlates with stock or copy changes. */
    shopifyUpdatedAt: timestamp("shopify_updated_at", { withTimezone: true }),
    /** Number of images attached to the product. Proxy for hero/investment. */
    imageCount: integer("image_count"),
    /** Last time we hit /products/{handle}.json for the meta fields above.
     *  We only re-fetch when this is >24h old, to keep request volume low. */
    lastMetaCrawledAt: timestamp("last_meta_crawled_at", { withTimezone: true }),

    // ─── Tier 2: scraped from the PDP HTML (JSON-LD, review widgets) ────
    /** Global Trade Item Number — UPC/EAN — from JSON-LD if exposed. Hard
     *  identifier for cross-store linking, much better than fuzzy title. */
    gtin: text("gtin"),
    /** Manufacturer Part Number from JSON-LD. */
    mpn: text("mpn"),
    /** Brand name from JSON-LD `brand.name` (vs merchant-set `vendor`). */
    brand: text("brand"),
    /** Latest review count, from JSON-LD aggregateRating or scraped widgets
     *  (Loox / Judge.me / Yotpo). Δ over time = sales velocity proxy. */
    reviewCount: integer("review_count"),
    /** Latest review score (0–5). */
    reviewScore: numeric("review_score", { precision: 3, scale: 2 }),
    /** JSON-LD priceValidUntil — pre-announced sale end date. */
    priceValidUntil: timestamp("price_valid_until", { withTimezone: true }),
    /** Detected social-proof widget kind (e.g. "salespop", "fomo"). NULL when
     *  not detected. Lets us flag products with active conversion FOMO apps. */
    socialProofWidget: text("social_proof_widget"),
    /** Last time we fetched the PDP HTML for JSON-LD/widgets. >24h stale. */
    lastPdpCrawledAt: timestamp("last_pdp_crawled_at", { withTimezone: true }),

    // ─── Market override (Shopify Markets routing) ─────────────────────
    /** ISO country code (e.g. "IE", "GB", "US") used when this product is
     *  crawled. Drives the Cookie/Accept-Language headers so Shopify
     *  Markets returns the right market's price. NULL means use the
     *  global default (GB/GBP). Set per-product so users can mix .ie /
     *  .co.uk / .com stores in one watchlist. */
    marketCountry: text("market_country"),
    /** ISO currency code (e.g. "EUR", "GBP", "USD") that pairs with the
     *  marketCountry. When set, the crawl forces this currency. */
    marketCurrency: text("market_currency"),

    /** True when this product appears in a "best sellers" / "featured" /
     *  "top products" collection on its store. Populated by the daily
     *  best-seller probe in store-scan, only run for stores with
     *  is_my_store = true (no point on competitors). Strongest demand
     *  signal we can derive from public data. */
    isBestseller: boolean("is_bestseller").notNull().default(false),

    /** Last time we ran the cart-add inventory probe on this product.
     *  Used to gate at most one probe per 24h. */
    lastInventoryProbedAt: timestamp("last_inventory_probed_at", {
      withTimezone: true,
    }),

    /** User-flagged favourite — surfaces a star in the products table and
     *  unlocks a Favourites filter. Single-account product, so no
     *  per-user scoping needed. */
    isFavourite: boolean("is_favourite").notNull().default(false),
  },
  (t) => [
    index("idx_products_store").on(t.storeDomain),
    index("idx_products_active").on(t.active),
    index("idx_products_gtin").on(t.gtin),
  ],
);

/**
 * Per-store profile — populated by the daily /api/crawl/stores cron.
 * Snapshots the store-level intel we surface on /stores and /stores/[domain]:
 * apps installed, theme, currency, free shipping, catalogue size.
 */
export const stores = pgTable(
  "stores",
  {
    domain: text("domain").primaryKey(),
    /** Inferred display name (e.g. "Gymshark" from "uk.gymshark.com"). */
    displayName: text("display_name"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
    /** Total products in /products.json paginated. Snapshot from last scan. */
    totalProductCount: integer("total_product_count"),
    /** How many we currently observe out of stock. Refreshed at scan time. */
    outOfStockCount: integer("out_of_stock_count"),
    /** Theme name and store ID, scraped from the storefront HTML. */
    themeName: text("theme_name"),
    themeStoreId: text("theme_store_id"),
    /** True when we detect Shopify Plus signals in the storefront. */
    isShopifyPlus: boolean("is_shopify_plus").notNull().default(false),
    /** The store's currency for our requests (after Markets / cart.js). */
    platformCurrency: text("platform_currency"),
    /** How many distinct markets / countries / locales we detected. */
    marketsCount: integer("markets_count"),
    /** Detected third-party apps. Shape: Array<{slug, name, kind}>.
     *  kind: "email" | "reviews" | "subscriptions" | "popups" | "support" |
     *        "analytics" | "other"  */
    appsDetected: jsonb("apps_detected")
      .$type<
        Array<{
          slug: string;
          name: string;
          kind: string;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** Free shipping threshold detected from announcement bar / cart drawer. */
    freeShippingThreshold: numeric("free_shipping_threshold", {
      precision: 12,
      scale: 2,
    }),
    freeShippingCurrency: text("free_shipping_currency"),
    /** Catalogue counts from /collections.json and /blogs.json. */
    collectionsCount: integer("collections_count"),
    blogsCount: integer("blogs_count"),
    /** Marks this store as the user's own — drives the /opportunities view.
     *  Only one row is allowed = true at a time (enforced in the server
     *  action). Unlocks the best-seller collection probe for this store. */
    isMyStore: boolean("is_my_store").notNull().default(false),
    /** Set when the cart-probe got a 403/429 from this store. We back off
     *  for 7 days before retrying — fighting bot protection rarely wins
     *  and just gets us flagged harder. NULL = no block recorded. */
    cartProbeBlockedAt: timestamp("cart_probe_blocked_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_stores_last_scanned").on(t.lastScannedAt),
    index("idx_stores_is_mine").on(t.isMyStore),
  ],
);

/**
 * Time-series snapshots of store-level metrics. Each row = one daily scan.
 * Used to plot "catalogue growth" and "stockout rate" trend lines on the
 * store profile page. Keeps history independent of the latest values on
 * the `stores` row.
 */
export const storeSnapshots = pgTable(
  "store_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeDomain: text("store_domain")
      .notNull()
      .references(() => stores.domain, { onDelete: "cascade" }),
    takenAt: timestamp("taken_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    totalProductCount: integer("total_product_count"),
    outOfStockCount: integer("out_of_stock_count"),
    newProductsLast24h: integer("new_products_last_24h"),
    appsCount: integer("apps_count"),
  },
  (t) => [index("idx_snapshots_store_time").on(t.storeDomain, t.takenAt)],
);

export const priceObservations = pgTable(
  "price_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => trackedProducts.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("GBP"),
  },
  (t) => [index("idx_price_product_time").on(t.productId, t.observedAt)],
);

export const stockObservations = pgTable(
  "stock_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => trackedProducts.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
    available: boolean("available").notNull(),
    /**
     * Total inventory across variants where the store exposes it.
     * NULL when the store doesn't have inventory tracking enabled or doesn't
     * publish quantities in the .js endpoint. Available boolean is always set.
     */
    quantity: integer("quantity"),
    /** Where the quantity came from:
     *  - 'public': read directly from /products/{handle}.js (free)
     *  - 'probed': inferred from a 422 response on /cart/add.js with a
     *    very large quantity. Daily-only, polite, opt-outable.
     *  - 'unknown': null quantity, source not tracked. */
    quantitySource: text("quantity_source", {
      enum: ["public", "probed", "unknown"],
    })
      .notNull()
      .default("unknown"),
    variantId: text("variant_id"), // null = product-level snapshot, set = variant-level
  },
  (t) => [index("idx_stock_product_time").on(t.productId, t.observedAt)],
);

export const crawlJobs = pgTable(
  "crawl_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => trackedProducts.id, { onDelete: "cascade" }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    status: text("status", { enum: ["pending", "running", "ok", "failed"] })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
  },
  (t) => [
    index("idx_jobs_status_scheduled").on(t.status, t.scheduledFor),
    index("idx_jobs_product").on(t.productId),
  ],
);

/**
 * App-wide settings (singleton row, id = 'singleton'). Phase 2 will move these
 * onto the `users` table as per-user preferences.
 */
export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey().default("singleton"),
  notificationEmails: text("notification_emails")
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  /** How often the dispatch crawler refreshes products. Drives the
   *  cooldown window in lib/crawler/dispatch.ts. Plan-gated in the UI:
   *  free/starter capped at daily, growth at every-6h, pro at hourly. */
  crawlCadence: text("crawl_cadence", {
    enum: ["daily", "every-6h", "hourly"],
  })
    .notNull()
    .default("hourly"),
  /** Which markets the daily multi-market price scan polls. Stored as
   *  ISO country codes; lib/crawler/multi-market.ts looks them up
   *  against a whitelist with default currency mapping. */
  multiMarketCountries: text("multi_market_countries")
    .array()
    .notNull()
    .default(sql`ARRAY['GB','IE','US','DE','AU','CA','JP']::text[]`),
  /** Global on/off for the cart-add inventory probe. When true, the daily
   *  05:30 UTC cron probes /cart/add.js on products where the public
   *  endpoints don't expose inventory_quantity. Defaults to true on a
   *  permissive rollout — users disable it explicitly if they prefer. */
  cartProbeEnabled: boolean("cart_probe_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Tags metadata. The actual tag-to-product association lives in the
 * `tracked_products.tags` text[] column (denormalised for cheap reads).
 * This table just stores per-tag display metadata like colour.
 */
export const tags = pgTable("tags", {
  name: text("name").primaryKey(), // lowercase, trimmed
  color: text("color").notNull().default("gray"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Product groups. When users link multiple tracked products together
 * (same item across different stores), they share a group_id. A group's
 * `name` is human-friendly (defaults to the first product's title).
 */
export const productGroups = pgTable("product_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Audit/dedupe log for sent email alerts. Used to suppress repeated firings
 * of the same alert kind for the same product within a short window.
 */
export const alertLog = pgTable(
  "alert_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => trackedProducts.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["stock_in", "stock_out", "price_drop"] }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_alerts_product_sent").on(t.productId, t.sentAt)],
);

/**
 * Auto-suggested links for products that look like the same item across
 * stores. Created post-bulk-add by the suggestion engine; user reviews and
 * accepts/dismisses on /products/suggestions.
 */
export const linkSuggestions = pgTable(
  "link_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productAId: uuid("product_a_id")
      .notNull()
      .references(() => trackedProducts.id, { onDelete: "cascade" }),
    productBId: uuid("product_b_id")
      .notNull()
      .references(() => trackedProducts.id, { onDelete: "cascade" }),
    score: numeric("score", { precision: 5, scale: 3 }).notNull(),
    status: text("status", { enum: ["pending", "accepted", "dismissed"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_suggestions_status").on(t.status)],
);

export type TrackedProduct = typeof trackedProducts.$inferSelect;
export type NewTrackedProduct = typeof trackedProducts.$inferInsert;
export type PriceObservation = typeof priceObservations.$inferSelect;
export type StockObservation = typeof stockObservations.$inferSelect;
export type CrawlJob = typeof crawlJobs.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type ProductGroup = typeof productGroups.$inferSelect;
export type AlertLog = typeof alertLog.$inferSelect;
export type LinkSuggestion = typeof linkSuggestions.$inferSelect;
export type WaitlistEntry = typeof waitlist.$inferSelect;
export type DiscoveredProduct = typeof discoveredProducts.$inferSelect;
export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;
export type StoreSnapshot = typeof storeSnapshots.$inferSelect;
export type MultiMarketObservation = typeof multiMarketObservations.$inferSelect;

/**
 * Daily multi-market price/stock snapshots — same product, different
 * Shopify Markets headers, different price. Powers the "Across markets"
 * panel on the product detail page so users can spot cross-market markup
 * arbitrage and currency-conversion lag.
 *
 * One row per product per market per day. Latest 30 days kept; older rows
 * pruned by the daily scan to keep the table bounded.
 */
export const multiMarketObservations = pgTable(
  "multi_market_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => trackedProducts.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Country ISO code, e.g. "IE", "US". */
    country: text("country").notNull(),
    /** Currency ISO code returned for that market. */
    currency: text("currency").notNull(),
    price: numeric("price", { precision: 12, scale: 2 }),
    available: boolean("available"),
  },
  (t) => [
    index("idx_mm_product_time").on(t.productId, t.observedAt),
    index("idx_mm_product_country").on(t.productId, t.country),
  ],
);

/**
 * Products discovered on stores the user already tracks but not yet in
 * their watchlist. Populated by a daily catalogue crawl that lists every
 * Shopify product on each store-domain with at least one active tracked
 * product. Surfaced on the /discover page with one-click 'Track' /
 * 'Dismiss' actions.
 */
export const discoveredProducts = pgTable(
  "discovered_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeDomain: text("store_domain").notNull(),
    handle: text("handle").notNull(),
    title: text("title"),
    imageUrl: text("image_url"),
    /** Full canonical product URL (constructed from store_domain + handle). */
    url: text("url").notNull().unique(),
    firstSeen: timestamp("first_seen", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: text("status", { enum: ["new", "dismissed"] })
      .notNull()
      .default("new"),
  },
  (t) => [
    index("idx_discovered_status").on(t.status),
    index("idx_discovered_store").on(t.storeDomain),
  ],
);

/**
 * Pre-launch waitlist. Phase 3 (Stripe billing) replaces this with a real
 * signup flow; until then we just collect email + optional store/URL so
 * we can email people when launch is ready.
 */
export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    storeUrl: text("store_url"),
    source: text("source"), // 'hero' | 'demo' | 'pricing' | 'footer'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_waitlist_email").on(t.email)],
);

/** Available tag colours. Keep in sync with TAG_COLOURS in components/tag-chip.tsx */
export const TAG_COLOR_NAMES = [
  "gray",
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
] as const;
export type TagColor = (typeof TAG_COLOR_NAMES)[number];
