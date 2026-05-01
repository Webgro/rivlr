/**
 * Plan / entitlement gating. Phase 1 has no real users yet, so this returns
 * the 'owner' tier for everyone signed in. When Phase 3 (Stripe billing)
 * lands, this becomes the source of truth for what each user can access.
 *
 * Pre-built so all feature-gated code already calls into this — switching
 * to real plan logic is a one-file change later.
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

/**
 * Returns the current user's plan. For Phase 1 this is always 'owner'
 * because there's only one user (you) on the password gate.
 */
export async function getCurrentPlan(): Promise<Plan> {
  return "owner";
}

export async function getPlanFeatures() {
  const plan = await getCurrentPlan();
  return { plan, features: PLAN_FEATURES[plan] };
}
