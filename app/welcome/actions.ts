"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";
import {
  completeOnboarding,
  runImportJob,
  skipOwnStore,
  startJob,
  validateShopifyStore,
} from "@/lib/onboarding";
import { scanStoreNow } from "@/lib/crawler/store-scan";

export type StepResult = { ok: true } | { ok: false; error: string };

/**
 * Register a store the user owns or competes with, and start importing
 * its catalogue in the background.
 *
 * The import is deliberately not awaited: a 3,000-product catalogue
 * takes long enough that holding the response would look like a hung
 * form. The job row it writes is what the progress screen reads.
 */
async function addStoreForSetup(
  kind: "mine" | "competitor",
  rawUrl: string,
): Promise<StepResult> {
  const user = await requireUser();

  const check = await validateShopifyStore(rawUrl);
  if (!check.ok) return { ok: false, error: check.error };
  const { domain } = check;

  if (kind === "competitor") {
    // Comparing a store against itself produces a page of every product
    // matching itself at a 0% gap, which reads as a bug.
    const [mineJob] = await db
      .select({ domain: schema.onboardingJobs.domain })
      .from(schema.onboardingJobs)
      .where(
        and(
          eq(schema.onboardingJobs.userId, user.id),
          eq(schema.onboardingJobs.kind, "mine"),
        ),
      );
    if (mineJob?.domain && mineJob.domain === domain) {
      return {
        ok: false,
        error: "That's your own store. Add a competitor's address instead.",
      };
    }
  }

  await db.insert(schema.stores).values({ domain }).onConflictDoNothing();

  // A store pref row is what makes the store show up in the app at all,
  // and `is_my_store` is what the matcher uses to tell the two sides
  // apart.
  await db
    .insert(schema.userStorePrefs)
    .values({ userId: user.id, domain, isMyStore: kind === "mine" })
    .onConflictDoUpdate({
      target: [schema.userStorePrefs.userId, schema.userStorePrefs.domain],
      set: { isMyStore: kind === "mine" },
    });

  await startJob(user.id, kind, domain);

  after(async () => {
    await runImportJob(user.id, kind, domain);
    try {
      await scanStoreNow(domain);
    } catch {
      // Store-level intel is a bonus; the daily scan will fill it in.
    }
  });

  return { ok: true };
}

export async function submitOwnStore(
  _prev: StepResult | null,
  formData: FormData,
): Promise<StepResult> {
  const result = await addStoreForSetup(
    "mine",
    String(formData.get("domain") ?? ""),
  );
  if (!result.ok) return result;
  redirect("/welcome");
}

export async function submitCompetitor(
  _prev: StepResult | null,
  formData: FormData,
): Promise<StepResult> {
  const result = await addStoreForSetup(
    "competitor",
    String(formData.get("domain") ?? ""),
  );
  if (!result.ok) return result;
  redirect("/welcome");
}

export async function skipStoreStep(): Promise<void> {
  const user = await requireUser();
  await skipOwnStore(user.id);
  redirect("/welcome");
}

/**
 * Leave setup for the app proper.
 *
 * Reachable from every step, because a user who cannot find their way
 * out of a setup wizard has no way to use the thing they signed up for.
 */
export async function finishSetup(): Promise<void> {
  const user = await requireUser();
  await completeOnboarding(user.id);
  revalidatePath("/dashboard");
  redirect("/dashboard?setup=done");
}

/**
 * Mark setup complete and return, leaving the caller to navigate.
 *
 * For the client components. A server action that redirects, awaited
 * inside a transition, keeps that transition pending until the router
 * has finished fetching the destination, so the button it belongs to
 * goes on saying "Setting up" through the whole of the next page's
 * render, and says nothing at all if the navigation quietly fails.
 * Doing the navigation ourselves makes the button's state mean only
 * what it says.
 */
export async function completeSetupOnly(): Promise<void> {
  const user = await requireUser();
  await completeOnboarding(user.id);
  revalidatePath("/dashboard");
}

/** Where finishSetupAndGo is allowed to land. */
const EXIT_DESTINATIONS = new Set([
  "/dashboard",
  "/discovery",
  "/products/new",
  "/stores",
]);

/**
 * End setup and continue to a specific page.
 *
 * Every route out of setup has to go through something that marks it
 * finished. A plain link to another app page looks like it works and
 * doesn't: the app layout sends anyone with unfinished setup back to
 * /welcome, so the user ends up in a redirect loop.
 *
 * The destination is checked against a fixed list rather than trusted,
 * so a crafted form post can't turn this into an open redirect.
 */
export async function finishSetupAndGo(formData: FormData): Promise<void> {
  const user = await requireUser();
  await completeOnboarding(user.id);
  const requested = String(formData.get("to") ?? "");
  revalidatePath("/dashboard");
  redirect(EXIT_DESTINATIONS.has(requested) ? requested : "/dashboard");
}
