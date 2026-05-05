import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";

/**
 * Plan / entitlement gating.
 *
 * Resolution order:
 *   1. Not signed in → 'free' (UI rarely renders for unauthed users; this
 *      keeps gates safe by default).
 *   2. user.id === OWNER_USER_ID → 'owner' (founder bypass; never billed).
 *   3. subscriptions row with an entitled status → row.plan.
 *   4. Otherwise → 'free'.
 *
 * "Entitled" = `active` or `trialing`. Anything else (past_due, canceled,
 * incomplete, etc.) drops back to free until the user resolves it via
 * the Customer Portal. Hard but predictable; no ambiguous "kinda paid"
 * state to reason about.
 */

export type Plan = "free" | "starter" | "growth" | "pro" | "owner";
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
    maxCadence: "hourly",
    cadence: "hourly",
  },
  owner: {
    discoverVisible: Infinity,
    compare: true,
    productLimit: null,
    maxCadence: "hourly",
    cadence: "hourly",
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
