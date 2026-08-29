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
 * Phase 3 schema — per-user via magic-link auth. The `users` table is the
 * tenant boundary; every user-owned table gets a `user_id` FK. Each `user_id`
 * starts nullable on the existing tables so the first-signup adoption
 * migration can assign current data to the new owner without an outage.
 * Once back-filled, queries enforce `WHERE user_id = ?` everywhere.
 */

// ─── Auth tables ───────────────────────────────────────────────────────

/**
 * One row per signed-up account. Stores the email + lifecycle timestamps.
 * No password hash — auth is magic-link only. Stripe customer id lives
 * here so Phase 4 (billing) has a place to hang it.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Set when the magic-link verify flow completes for the first time. */
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    /** Set when the user finishes (or skips) the guided setup flow.
     *  NULL means they still get sent to /welcome on sign-in. Stored
     *  rather than inferred from data so skipping is remembered. */
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    /** Phase 4 — Stripe customer id. NULL until first successful payment. */
    stripeCustomerId: text("stripe_customer_id"),
    /** Superadmin flag. Admins can read all users, override plans,
     *  comp accounts, and delete users from /admin. NULL/false for the
     *  vast majority of accounts. Falls back to ADMIN_USER_IDS env var
     *  for bootstrap (when the DB is unreachable or no admin exists yet). */
    isAdmin: boolean("is_admin").notNull().default(false),
    /** Admin override of the plan resolver — when set, this user is
     *  treated as if they're on this plan regardless of subscription
     *  state. Used for comping strategic customers, extending trials,
     *  bespoke enterprise deals, or fixing post-Stripe-incident drift.
     *  NULL = fall through to subscription-based resolution. */
    compPlan: text("comp_plan", {
      enum: ["free", "starter", "growth", "pro", "scale", "owner", "unlimited"],
    }),
    /** Free-text rationale shown alongside the comp in /admin and the
     *  audit log. Required when compPlan is set; nulled when removed. */
    compReason: text("comp_reason"),
    /** When the comp was last set. NULL when no comp active. */
    compSetAt: timestamp("comp_set_at", { withTimezone: true }),
  },
  (t) => [index("idx_users_email").on(t.email)],
);

/**
 * Active session cookies. Server-controlled invalidation: deleting the
 * row revokes the session everywhere immediately. Cookie carries the
 * id; cookie value isn't sensitive on its own (must match a row).
 *
 * 30-day rolling expiry — `lastSeenAt` updates on every authed request,
 * `expiresAt` recomputed from that. Session pruned on first request
 * after `expiresAt` passes.
 */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Diagnostic — captured at create time. Used in a future "active
     *  sessions" page in Settings so the user can revoke remotely. */
    ip: text("ip"),
    userAgent: text("user_agent"),
    /** When set, this session was created by an admin impersonating
     *  the userId account. Plain user logins leave this null. The
     *  (app) layout uses presence of this to render the impersonation
     *  banner; "stop impersonating" destroys this session and starts
     *  a fresh one for the impersonator. set null on FK retention so
     *  deleting the admin doesn't cascade-kill running impersonation
     *  sessions (their target_user_id stays valid). */
    impersonatorUserId: uuid("impersonator_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
  },
  (t) => [
    index("idx_sessions_user").on(t.userId),
    index("idx_sessions_expires").on(t.expiresAt),
  ],
);

/**
 * Additional email addresses authorised to sign in to a user's account.
 * Sharing model: one Rivlr account, multiple authorised inboxes (Gmail's
 * "shared mailbox" pattern, not Slack-style multi-tenant teams).
 *
 * Lookup: /auth/verify resolves an incoming email by unioning users.email
 * with this table. Whichever inbox the magic link landed in, the resulting
 * session is owned by the parent user. Same data scope, multiple entry
 * points.
 *
 * No roles for now — every authorised email has the same access. Roles
 * (admin / editor / viewer) become a column here later if needed.
 */
export const userEmails = pgTable(
  "user_emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    /** When the inviter sent the original magic link. NULL for the
     *  primary email (which IS the user's own). */
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    /** Tracks which user added this email. Useful for the audit log
     *  ("Sarah added staff@store.com on 2026-05-02"). */
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    index("idx_user_emails_email").on(t.email),
    index("idx_user_emails_user").on(t.userId),
  ],
);

/**
 * Pending magic links. Token is HMAC-derived (see lib/auth/magic-link.ts)
 * and only the hash lives here — original token never persisted, so a DB
 * leak doesn't grant inbox-free authentication.
 *
 * Single-use: `usedAt` non-null means the link was consumed, can't be
 * replayed. Expired-but-unused rows get pruned on the next verify call.
 */
export const authMagicLinks = pgTable(
  "auth_magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    /** sha256(token). Look up by hash, never store the raw token. */
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    /** Where to redirect after successful verification. */
    redirectTo: text("redirect_to"),
  },
  (t) => [
    index("idx_magic_links_token").on(t.tokenHash),
    index("idx_magic_links_email").on(t.email),
  ],
);

export const trackedProducts = pgTable(
  "tracked_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Owner. NOT NULL — the first-signup adoption pass + ongoing inserts
     *  guarantee every row has a user. Pre-Phase-3 data was claimed by the
     *  first verified user when they completed sign-in. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
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

    /** Variant SKUs, deduped and upper-cased. Read from the catalogue
     *  endpoint (free, whole store at once) and refreshed on each crawl.
     *  This is the highest-coverage identifier we have for matching the
     *  same physical product across two retailers: resellers commonly
     *  carry the manufacturer's SKU verbatim, whereas GTIN is published
     *  by only a fifth of stores and, in practice, never agrees between
     *  them. */
    skus: text("skus")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** Variant barcodes (EAN/UPC) from the per-product endpoint. Only
     *  available once a product is tracked, so it is a secondary match
     *  key rather than a discovery one. */
    barcodes: text("barcodes")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    /** Last time we ran the cart-add inventory probe on this product.
     *  Used to gate at most one probe per 24h. */
    lastInventoryProbedAt: timestamp("last_inventory_probed_at", {
      withTimezone: true,
    }),

    /** User-flagged favourite — surfaces a star in the products table and
     *  unlocks a Favourites filter. Single-account product, so no
     *  per-user scoping needed. */
    isFavourite: boolean("is_favourite").notNull().default(false),

    // ─── Denormalised latest state ─────────────────────────────────
    // Mirrors of the newest price/stock observation, written by the
    // crawler alongside each observation insert. Exists because the
    // observation tables are history (800k+ rows and growing) and every
    // "current price / in stock right now" question was being answered
    // with per-product LATERAL probes or DISTINCT ON scans over them —
    // the dashboard's out-of-stock count alone took ~2s. Hot pages read
    // these columns; the observation tables stay for charts and trends.
    /** Newest observed price. NULL until first crawl. */
    latestPrice: numeric("latest_price", { precision: 12, scale: 2 }),
    /** Newest observed availability. NULL until first crawl. */
    latestAvailable: boolean("latest_available"),
    /** Newest observed quantity (NULL when the store hides inventory). */
    latestQuantity: integer("latest_quantity"),
    /** When the latest_* values were last written. */
    latestObservedAt: timestamp("latest_observed_at", { withTimezone: true }),
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
    /** When true, every new product the daily discovery cron finds on
     *  this store is auto-tracked instead of staged in
     *  discovered_products. Blank-slate way to "watch everything". */
    autoTrackNew: boolean("auto_track_new").notNull().default(false),
  },
  (t) => [
    index("idx_stores_last_scanned").on(t.lastScannedAt),
    index("idx_stores_is_mine").on(t.isMyStore),
  ],
);

/**
 * Per-user attributes attached to a store. Lets two users mark different
 * stores as "mine" or set their own auto-track preferences without the
 * shared `stores` table getting tangled up in per-user state.
 *
 * Composite PK (user_id, domain) — no synthetic id needed, lookups are
 * always "give me this user's prefs for this domain".
 *
 * `cart_probe_blocked_at` STAYS on the global `stores` table because
 * bot-protection is a property of the store itself, not the user.
 */
export const userStorePrefs = pgTable(
  "user_store_prefs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    isMyStore: boolean("is_my_store").notNull().default(false),
    autoTrackNew: boolean("auto_track_new").notNull().default(false),
    setAt: timestamp("set_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_usp_user").on(t.userId),
    index("idx_usp_user_my_store").on(t.userId, t.isMyStore),
    // Composite primary key via unique index — Drizzle's pgTable doesn't
    // expose composite PK syntax cleanly, so we add a unique covering both.
    index("idx_usp_user_domain_unique").on(t.userId, t.domain),
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
 * Per-user preferences. `id` is the user's UUID as text — one row per user.
 * Pre-Phase-3 there was a single 'singleton' row; the /auth/verify adoption
 * migration on first signup copies that row to id=user.id and the singleton
 * is then ignored. We keep `id` as text rather than uuid so existing rows
 * don't fight a type change during the transition.
 */
export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(),
  /** Owner reference. Same value as id — present for FK clarity in joins. */
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
  /** Threshold in days for the "About to go dark" Opportunities section.
   *  Competitor products whose remaining inventory (units / daily sales
   *  rate) falls below this number are surfaced as an early-warning
   *  signal. Default 7 = one week. Range 1–90 enforced by the server
   *  action. */
  daysCoverThreshold: integer("days_cover_threshold").notNull().default(7),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Tags metadata. The actual tag-to-product association lives in the
 * `tracked_products.tags` text[] column (denormalised for cheap reads).
 * This table just stores per-tag display metadata like colour.
 */
export const tags = pgTable("tags", {
  name: text("name").primaryKey(), // lowercase, trimmed
  /** Owner. Tags are per-user — your "premium" tag isn't my "premium"
   *  tag. */
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
  /** Owner of the group. */
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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
    kind: text("kind", {
      enum: [
        "stock_in",
        "stock_out",
        "price_drop",
        "days_cover_warning",
        "weekly_digest",
        "undercut",
      ],
    }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_alerts_product_sent").on(t.productId, t.sentAt)],
);

/**
 * Email addresses that have unsubscribed. Checked before every send.
 * Lower-case-normalised on insert. A single row per address — global
 * unsubscribe (matches the standard one-click unsubscribe expectation
 * from Gmail / Outlook / RFC 8058).
 */
export const emailUnsubscribes = pgTable("email_unsubscribes", {
  email: text("email").primaryKey(),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Free-text source so we can tell why someone left
   *  (e.g. 'one-click', 'list-unsubscribe-header', 'manual'). */
  source: text("source"),
});

/**
 * Auto-suggested links for products that look like the same item across
 * stores. Created post-bulk-add by the suggestion engine; user reviews and
 * accepts/dismisses on /products/suggestions.
 */
export const linkSuggestions = pgTable(
  "link_suggestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Owner of the suggestion. Derived from the products' owners (which
     *  must be the same user since we don't suggest cross-user links).
     *  Stored explicitly so /products/suggestions can scope cleanly. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
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

/**
 * Per-user Stripe subscription state. One row per paying user; absence of
 * a row = free plan. Mirrors the bits of Stripe's subscription object we
 * actually consult for entitlement checks. Authoritative copy is Stripe's,
 * but we cache locally so plan resolution never has to round-trip.
 *
 * Updated by the /api/billing/webhook handler on every subscription event.
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    /** Composite key + FK in one. One subscription per user. */
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Stripe subscription id (sub_…). Unique across the system. */
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    /** Which paid tier they're on. Mirrors lib/plan.ts Plan minus 'free'
     *  (no row = free) and 'owner' (env var override, never persisted). */
    plan: text("plan", { enum: ["starter", "growth", "pro", "scale"] }).notNull(),
    /** Stripe subscription status. We treat 'active' and 'trialing' as
     *  entitled; everything else falls back to free until resolved. */
    status: text("status", {
      enum: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "incomplete",
        "incomplete_expired",
        "unpaid",
      ],
    })
      .notNull()
      .default("active"),
    /** End of the current billing period — when the next invoice fires
     *  (or the cancellation takes effect, if cancel_at_period_end is set). */
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    /** Customer scheduled cancellation; access continues until
     *  currentPeriodEnd, then drops to free. */
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    /** Number of extra packs (Scale only). Each pack = +100 products on
     *  top of the 250-product base. Mirrored from the second subscription
     *  item's quantity by the webhook handler so plan resolution stays a
     *  single table read. Always 0 on Starter / Growth, where packs
     *  aren't sold. */
    overagePacks: integer("overage_packs").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_subscriptions_status").on(t.status)],
);

/**
 * Audit log for superadmin actions. Every action that mutates another
 * user's state (override plan, delete, etc.) writes a row. Read-only
 * actions (view user) are NOT logged — they'd flood the table without
 * adding much value. Future feature: scope view-actions behind an
 * "audit access" toggle for compliance-heavy customers.
 *
 * FK retention: actor / target are nullable + onDelete: set null so
 * deleting either user (admin or target) doesn't cascade-wipe the
 * audit history. We also stamp `actorEmail` / `targetEmail` on the
 * row at write time so the log stays human-readable forever.
 */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Captured at write time so the log stays readable after the
     *  admin's account is deleted. */
    actorEmail: text("actor_email").notNull(),
    targetUserId: uuid("target_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    targetEmail: text("target_email"),
    /** Short verb identifying the action — e.g. "override_plan",
     *  "clear_comp", "delete_user". Matches the helper that wrote it. */
    action: text("action").notNull(),
    /** JSON blob with action-specific context. Examples:
     *  { from: "free", to: "growth", reason: "trial extension" } */
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_audit_target_time").on(t.targetUserId, t.occurredAt),
    index("idx_audit_actor_time").on(t.actorUserId, t.occurredAt),
  ],
);

/**
 * Stripe webhook idempotency log. One row per processed event id, written
 * after the handler runs. Stripe retries failed webhooks aggressively;
 * checking this table early in the route handler turns retries into
 * cheap no-ops without us having to make every handler perfectly
 * re-runnable.
 *
 * Pruning: rows older than 30 days are safe to delete (Stripe stops
 * retrying after ~3 days). Cron-pruning is future work — table stays
 * small naturally for early stage usage.
 */
export const processedStripeEvents = pgTable(
  "processed_stripe_events",
  {
    id: text("id").primaryKey(), // Stripe event id (evt_…)
    type: text("type").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_pse_processed_at").on(t.processedAt)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type AuthSession = typeof authSessions.$inferSelect;
export type AuthMagicLink = typeof authMagicLinks.$inferSelect;
export type UserEmail = typeof userEmails.$inferSelect;
export type UserStorePref = typeof userStorePrefs.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type AdminAuditLogEntry = typeof adminAuditLog.$inferSelect;
export type NewAdminAuditLogEntry = typeof adminAuditLog.$inferInsert;
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
    /** Owner. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storeDomain: text("store_domain").notNull(),
    handle: text("handle").notNull(),
    title: text("title"),
    imageUrl: text("image_url"),
    /** Full canonical product URL (constructed from store_domain + handle).
     *  Was unique globally pre-Phase-3; now will be unique per (user, url).
     *  Composite unique added in the Phase 3 commit 2 migration. */
    url: text("url").notNull(),
    /** Variant SKUs, same normalisation as tracked_products.skus. The
     *  catalogue endpoint gives us these for free, so a competitor's
     *  whole range can be matched against the user's own products
     *  without tracking any of it first. */
    skus: text("skus")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    /** Cheapest variant price at last catalogue scan. Lets the match
     *  list show "they sell it at X" before anything is tracked. */
    price: numeric("price", { precision: 12, scale: 2 }),
    /** Whether any variant was in stock at last catalogue scan. */
    available: boolean("available"),
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
 * Public share links. The row id doubles as the unguessable token in
 * /share/[token]. One active link per (user, product) is enforced in the
 * action layer, not the schema; revoking sets revoked_at rather than
 * deleting so a leaked old URL stays dead even if a new link is created.
 */
export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** What the link exposes. Product-only today; store profiles later. */
    kind: text("kind", { enum: ["product"] }).notNull().default("product"),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("idx_share_links_target").on(t.targetId)],
);

export type ShareLink = typeof shareLinks.$inferSelect;

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
