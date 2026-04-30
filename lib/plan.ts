/**
 * Plan / entitlement gating. Phase 1 has no real users yet, so this returns
 * the 'owner' tier for everyone signed in. When Phase 3 (Stripe billing)
 * lands, this becomes the source of truth for what each user can access.
 *
 * Pre-built so all feature-gated code already calls into this — switching
 * to real plan logic is a one-file change later.
 */

export type Plan = "free" | "starter" | "growth" | "pro" | "owner";

interface PlanFeatures {
  /** How many discoveries the user can see / track. Above this, blurred. */
  discoverVisible: number;
  /** Whether the Compare view is unlocked. */
  compare: boolean;
  /** Max tracked products. */
  productLimit: number | null;
  /** Crawl cadence (informational — actually controlled in dispatch). */
  cadence: "daily" | "every-6h" | "hourly";
}

export const PLAN_FEATURES: Record<Plan, PlanFeatures> = {
  free: {
    discoverVisible: 5,
    compare: false,
    productLimit: 5,
    cadence: "daily",
  },
  starter: {
    discoverVisible: 25,
    compare: false,
    productLimit: 50,
    cadence: "daily",
  },
  growth: {
    discoverVisible: 100,
    compare: true,
    productLimit: 150,
    cadence: "every-6h",
  },
  pro: {
    discoverVisible: Infinity,
    compare: true,
    productLimit: 400,
    cadence: "hourly",
  },
  owner: {
    discoverVisible: Infinity,
    compare: true,
    productLimit: null,
    cadence: "hourly",
  },
};

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
