import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PRODUCTS_PER_OVERAGE_PACK } from "@/lib/stripe";

/**
 * Plan / entitlement gating.
 *
 * Resolution order:
 *   1. Not signed in → 'free' (UI rarely renders for unauthed users; this
 *      keeps gates safe by default).
 *   2. user.id === OWNER_USER_ID → 'owner' (founder bypass; never billed).
 *   3. users.comp_plan set → that plan (admin override; e.g. comping a
 *      strategic customer to Pro without a Stripe subscription).
 *   4. subscriptions row with an entitled status → row.plan.
 *   5. Otherwise → 'free'.
 *
 * "Entitled" = `active` or `trialing`. Anything else (past_due, canceled,
 * incomplete, etc.) drops back to free until the user resolves it via
 * the Customer Portal. Hard but predictable; no ambiguous "kinda paid"
 * state to reason about.
 */

export type Plan =
  | "free"
  | "starter"
  | "growth"
  | "pro"
  | "scale"
  | "owner"
  | "unlimited";
export type Cadence = "daily" | "every-6h" | "hourly";

interface PlanFeatures {
  /** How many discoveries the user can see / track. Above this, blurred. */
  discoverVisible: number;
  /** Whether the Compare view is unlocked. */
  compare: boolean;
  /** Max tracked products. */
  productLimit: number | null;
  /** Maximum crawl cadence allowed on this plan. The user can pick any
   *  cadence at or below this in Settings; faster ones are visibly locked
   *  with an upgrade CTA. */
  maxCadence: Cadence;
  /** Default cadence used when settings haven't been initialised. */
  cadence: Cadence;
}

/** Cooldown (ms) corresponding to each cadence. Drives lib/crawler/dispatch.ts.
 *  The 10-minute cron picks products up at intervals of these durations. */
export const CADENCE_COOLDOWN_MS: Record<Cadence, number> = {
  daily: 23 * 60 * 60 * 1000, // 23h
  "every-6h": 5 * 60 * 60 * 1000 + 50 * 60 * 1000, // 5h50m
  hourly: 55 * 60 * 1000, // 55m
};

/** Cadence rank — used to tell whether the user's chosen cadence is
 *  allowed by their plan. Higher is faster. */
export const CADENCE_RANK: Record<Cadence, number> = {
  daily: 0,
  "every-6h": 1,
  hourly: 2,
};

export const CADENCE_LABELS: Record<Cadence, string> = {
  daily: "Daily",
  "every-6h": "Every 6 hours",
  hourly: "Hourly",
};

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    discoverVisible: 5,
    compare: false,
    productLimit: 5,
    maxCadence: "daily",
    cadence: "daily",
  },
  starter: {
    discoverVisible: 25,
    compare: false,
    productLimit: 50,
    maxCadence: "daily",
    cadence: "daily",
  },
  growth: {
    discoverVisible: 100,
    compare: true,
    productLimit: 150,
    maxCadence: "every-6h",
    cadence: "every-6h",
  },
  pro: {
    discoverVisible: Infinity,
    compare: true,
    productLimit: 400,
    maxCadence: "every-6h",
    cadence: "every-6h",
  },
  // Top self-serve tier for "track every competitor's full catalogue"
  // buyers. Deliberately capped (not "unlimited") so the crawl cost per
  // account stays bounded; above this it's a sales conversation.
  scale: {
    discoverVisible: Infinity,
    compare: true,
    productLimit: 2500,
    maxCadence: "every-6h",
    cadence: "every-6h",
  },
  // Cadence tops out at every-6h across the whole product. Hourly was
  // dropped deliberately: it multiplied crawl cost 6x for marginal
  // value, and one large hourly account could outrun the batch
  // crawler's daily throughput.
  owner: {
    discoverVisible: Infinity,
    compare: true,
    productLimit: null,
    maxCadence: "every-6h",
    cadence: "every-6h",
  },
  // Soft-launch / beta tester tier. Same caps as owner (i.e. none) but a
  // distinct identity so the audit log + UI can tell "we comped this
  // tester" apart from "this is the founder account". Only reachable via
  // an admin comp_plan override; never resolved from a Stripe subscription.
  unlimited: {
    discoverVisible: Infinity,
    compare: true,
    productLimit: null,
    maxCadence: "every-6h",
    cadence: "every-6h",
  },
};

/** Returns whether a cadence is allowed by the given plan. */
export function isCadenceAllowed(cadence: Cadence, plan: Plan): boolean {
  return CADENCE_RANK[cadence] <= CADENCE_RANK[PLAN_FEATURES[plan].maxCadence];
}

/** Statuses that grant entitlement. Everything else drops to free. */
const ENTITLED_STATUSES = new Set(["active", "trialing"]);

/**
 * Resolve a user id to a plan. Pure function over the DB — used by both
 * the request-time `getCurrentPlan()` (which loads the user first) and
 * by admin tooling that operates on arbitrary user ids.
 */
export async function getPlanForUser(userId: string): Promise<Plan> {
  const ownerId = process.env.OWNER_USER_ID;
  if (ownerId && userId === ownerId) return "owner";

  // Admin comp override (set via /admin) — beats subscription state.
  // Cheaper than joining: one extra single-row read on the indexed PK.
  const [userRow] = await db
    .select({ compPlan: schema.users.compPlan })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (userRow?.compPlan) return userRow.compPlan;

  const [row] = await db
    .select({ plan: schema.subscriptions.plan, status: schema.subscriptions.status })
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, userId))
    .limit(1);

  if (!row) return "free";
  if (!ENTITLED_STATUSES.has(row.status)) return "free";
  return row.plan;
}

/** Returns the currently signed-in user's plan. Free when unauthed. */
export async function getCurrentPlan(): Promise<Plan> {
  const user = await getCurrentUser();
  if (!user) return "free";
  return getPlanForUser(user.id);
}

export async function getPlanFeatures() {
  const plan = await getCurrentPlan();
  return { plan, features: PLAN_FEATURES[plan] };
}

/* ─── Product quota ─────────────────────────────────────────────── */

export interface ProductQuota {
  /** Number of active tracked products belonging to the user. */
  current: number;
  /** Plan-imposed cap; null = unlimited (owner only). */
  limit: number | null;
  /** How many more they can add before hitting the cap. null = unlimited. */
  remaining: number | null;
  /** 0..1 used fraction; 0 when limit is null. */
  fraction: number;
  /** True when current >= limit (no further inserts permitted). */
  full: boolean;
  /** Surfaces an "approaching limit" warning above 80%. */
  warning: boolean;
  plan: Plan;
}

/**
 * Resolve a user's effective product limit — base plan cap plus any
 * overage packs they've bought. Owner is unlimited (returns null).
 * Free / Starter / Growth always equal their base; only Pro can stack
 * overage packs.
 */
export async function getEffectiveProductLimit(
  userId: string,
): Promise<{ plan: Plan; baseLimit: number | null; overagePacks: number; effectiveLimit: number | null }> {
  const plan = await getPlanForUser(userId);
  const baseLimit = PLAN_FEATURES[plan].productLimit;

  // Overage only matters on Pro. On other plans we ignore any
  // (legacy / drifted) overage_packs value defensively.
  let overagePacks = 0;
  if (plan === "pro") {
    const [row] = await db
      .select({ packs: schema.subscriptions.overagePacks })
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, userId))
      .limit(1);
    overagePacks = row?.packs ?? 0;
  }

  const effectiveLimit =
    baseLimit === null
      ? null
      : baseLimit + overagePacks * PRODUCTS_PER_OVERAGE_PACK;

  return { plan, baseLimit, overagePacks, effectiveLimit };
}

/**
 * Pull the user's tracked-product count and compare it against their
 * effective plan limit (base + overage). Cheap — two single-row
 * lookups on indexed columns.
 *
 * Used by:
 *  - addProducts server action (hard cap before insert)
 *  - QuotaBar component on /dashboard, /billing, /products
 */
export async function getProductQuota(userId: string): Promise<ProductQuota> {
  const { plan, effectiveLimit } = await getEffectiveProductLimit(userId);

  const [row] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n
    FROM tracked_products
    WHERE user_id = ${userId}::uuid AND active = true
  `);
  const current = row?.n ?? 0;

  if (effectiveLimit === null) {
    return {
      current,
      limit: null,
      remaining: null,
      fraction: 0,
      full: false,
      warning: false,
      plan,
    };
  }

  const fraction = effectiveLimit > 0 ? current / effectiveLimit : 1;
  return {
    current,
    limit: effectiveLimit,
    remaining: Math.max(0, effectiveLimit - current),
    fraction: Math.min(1, fraction),
    full: current >= effectiveLimit,
    warning: fraction >= 0.8,
    plan,
  };
}

/**
 * Suggest the next plan up from the user's current one. Used in upgrade
 * CTAs so the link can deep-link directly at the appropriate tier.
 * Owner / Pro return null (no upgrade above them).
 */
export function suggestNextPlan(
  plan: Plan,
): "starter" | "growth" | "pro" | "scale" | null {
  switch (plan) {
    case "free":
      return "starter";
    case "starter":
      return "growth";
    case "growth":
      return "pro";
    case "pro":
      return "scale";
    default:
      return null;
  }
}
