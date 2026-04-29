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
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
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

export type TrackedProduct = typeof trackedProducts.$inferSelect;
export type NewTrackedProduct = typeof trackedProducts.$inferInsert;
export type PriceObservation = typeof priceObservations.$inferSelect;
export type StockObservation = typeof stockObservations.$inferSelect;
export type CrawlJob = typeof crawlJobs.$inferSelect;
