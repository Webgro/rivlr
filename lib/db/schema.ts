import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  index,
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
  },
  (t) => [index("idx_products_store").on(t.storeDomain), index("idx_products_active").on(t.active)],
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

export type TrackedProduct = typeof trackedProducts.$inferSelect;
export type NewTrackedProduct = typeof trackedProducts.$inferInsert;
export type PriceObservation = typeof priceObservations.$inferSelect;
export type StockObservation = typeof stockObservations.$inferSelect;
export type CrawlJob = typeof crawlJobs.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type ProductGroup = typeof productGroups.$inferSelect;

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
