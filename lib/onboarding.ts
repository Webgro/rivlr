import { db, schema } from "@/lib/db";
import { and, eq, sql } from "drizzle-orm";
import {
  importOwnStoreCatalogue,
  importCompetitorCatalogue,
} from "@/lib/catalogue-import";
import { findCatalogueMatches } from "@/lib/matching";
import { sendEmail } from "@/lib/email/send";
import { setupReadyEmail } from "@/lib/email/templates";

/**
 * Guided setup state.
 *
 * The step is derived from what is actually in the database rather than
 * held in a wizard's session or a URL parameter, because the imports it
 * waits on outlive the request that started them. A user who refreshes,
 * hits back, closes the tab over lunch, or opens setup on their phone
 * lands exactly where they left off, and no step can be reached by
 * typing a URL before the work behind it is done.
 */

export type WelcomeStep =
  | "store"
  | "competitor"
  | "importing"
  | "link"
  | "done";

/** Sentinel domain for "I skipped adding my own store". */
const SKIPPED = "";

export interface JobProgress {
  domain: string;
  expected: number;
  imported: number;
  status: "running" | "done" | "error";
  error: string | null;
}

export interface OnboardingState {
  step: WelcomeStep;
  /** Null when the user skipped adding their own store. */
  myDomain: string | null;
  competitorDomain: string | null;
  mine: JobProgress | null;
  competitor: JobProgress | null;
  /** 0-100 across both imports, for the setup progress bar. */
  percent: number;
}

type JobRow = {
  kind: "mine" | "competitor";
  domain: string;
  expected: number;
  imported: number;
  status: "running" | "done" | "error";
  error: string | null;
};

function toProgress(row: JobRow | undefined): JobProgress | null {
  if (!row) return null;
  const { domain, expected, imported, status, error } = row;
  return { domain, expected, imported, status, error };
}

export async function getOnboardingState(
  userId: string,
): Promise<OnboardingState> {
  const [userRow] = await db
    .select({ onboardedAt: schema.users.onboardedAt })
    .from(schema.users)
    .where(eq(schema.users.id, userId));

  const jobRows = await db
    .select({
      kind: schema.onboardingJobs.kind,
      domain: schema.onboardingJobs.domain,
      expected: schema.onboardingJobs.expected,
      imported: schema.onboardingJobs.imported,
      status: schema.onboardingJobs.status,
      error: schema.onboardingJobs.error,
    })
    .from(schema.onboardingJobs)
    .where(eq(schema.onboardingJobs.userId, userId));

  const mineRow = jobRows.find((j) => j.kind === "mine");
  const compRow = jobRows.find((j) => j.kind === "competitor");
  const mine = toProgress(mineRow);
  const competitor = toProgress(compRow);

  const myDomain =
    mineRow && mineRow.domain !== SKIPPED ? mineRow.domain : null;
  const competitorDomain = compRow?.domain ?? null;

  const bothDone =
    (!mine || mine.status !== "running") &&
    (!competitor || competitor.status !== "running");

  // Each import owns an equal share of the bar, rather than a share
  // proportional to its catalogue size. Sizes are the obvious weighting
  // but they are not known until each fetch returns, so a finished
  // 547-product store next to a competitor whose total is still unknown
  // read as 547/547 — a bar sitting at 99% while half the work had not
  // started. An unknown total simply contributes nothing to its own
  // share until it is known.
  // A skipped store carries an empty domain and imports nothing, so it
  // is not part of the bar — otherwise skipping parks it at 50% while a
  // single import runs.
  const jobs = [mine, competitor].filter(
    (j): j is JobProgress => j !== null && j.domain !== SKIPPED,
  );
  const percent = bothDone
    ? 100
    : jobs.length === 0
      ? 0
      : Math.min(
          99,
          Math.round(
            (jobs.reduce((sum, j) => {
              if (j.status !== "running") return sum + 1;
              if (j.expected <= 0) return sum;
              return sum + Math.min(1, j.imported / j.expected);
            }, 0) /
              jobs.length) *
              100,
          ),
        );

  let step: WelcomeStep;
  if (userRow?.onboardedAt) {
    step = "done";
  } else if (!mineRow) {
    step = "store";
  } else if (!compRow) {
    step = "competitor";
  } else if (!bothDone) {
    step = "importing";
  } else {
    step = "link";
  }

  return { step, myDomain, competitorDomain, mine, competitor, percent };
}

/** Create or reset a job row. */
export async function startJob(
  userId: string,
  kind: "mine" | "competitor",
  domain: string,
  expected = 0,
): Promise<void> {
  await db
    .insert(schema.onboardingJobs)
    .values({ userId, kind, domain, expected, imported: 0, status: "running" })
    .onConflictDoUpdate({
      target: [schema.onboardingJobs.userId, schema.onboardingJobs.kind],
      set: {
        domain,
        expected,
        imported: 0,
        status: "running",
        error: null,
        updatedAt: new Date(),
      },
    });
}

/** Record the store step as deliberately skipped. */
export async function skipOwnStore(userId: string): Promise<void> {
  await db
    .insert(schema.onboardingJobs)
    .values({
      userId,
      kind: "mine",
      domain: SKIPPED,
      expected: 0,
      imported: 0,
      status: "done",
    })
    .onConflictDoUpdate({
      target: [schema.onboardingJobs.userId, schema.onboardingJobs.kind],
      set: {
        domain: SKIPPED,
        expected: 0,
        imported: 0,
        status: "done",
        error: null,
        updatedAt: new Date(),
      },
    });
}

async function setProgress(
  userId: string,
  kind: "mine" | "competitor",
  imported: number,
  expected: number,
): Promise<void> {
  await db
    .update(schema.onboardingJobs)
    .set({ imported, expected, updatedAt: new Date() })
    .where(
      and(
        eq(schema.onboardingJobs.userId, userId),
        eq(schema.onboardingJobs.kind, kind),
      ),
    );
}

async function finishJob(
  userId: string,
  kind: "mine" | "competitor",
  error?: string,
): Promise<void> {
  await db
    .update(schema.onboardingJobs)
    .set({
      status: error ? "error" : "done",
      error: error ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.onboardingJobs.userId, userId),
        eq(schema.onboardingJobs.kind, kind),
      ),
    );
}

/**
 * Run one catalogue import to completion, keeping its job row current.
 *
 * Never throws: a failed import has to leave the setup flow in a state
 * the user can see and act on, not a progress bar that sits at 40%
 * forever. The error is written to the job row and surfaced on screen.
 */
export async function runImportJob(
  userId: string,
  kind: "mine" | "competitor",
  domain: string,
): Promise<void> {
  try {
    const onProgress = async (imported: number, expected: number) => {
      await setProgress(userId, kind, imported, expected);
    };
    if (kind === "mine") {
      await importOwnStoreCatalogue(userId, domain, { onProgress });
    } else {
      await importCompetitorCatalogue(userId, domain, { onProgress });
    }
    await finishJob(userId, kind);
  } catch {
    await finishJob(
      userId,
      kind,
      `We couldn't read the catalogue at ${domain}. You can carry on and add products later.`,
    );
  }

  await notifyIfSetupReady(userId);
}

/**
 * Email the user once both imports have landed.
 *
 * The setup screen tells people they can close the tab, so this is what
 * makes that true. Whichever job finishes second sends it — they run
 * concurrently and neither knows about the other, so the check is
 * "is anything still running?" rather than "am I last?".
 *
 * Best effort throughout: a failed send must not fail the import that
 * triggered it, and the setup screen still works for anyone who kept
 * the tab open.
 */
async function notifyIfSetupReady(userId: string): Promise<void> {
  try {
    const state = await getOnboardingState(userId);
    if (state.step !== "link") return;

    const [user] = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    if (!user?.email) return;

    let matchCount = 0;
    if (state.myDomain && state.competitorDomain) {
      const matches = await findCatalogueMatches({
        userId,
        competitorDomain: state.competitorDomain,
        limit: 25,
      });
      matchCount = matches.length;
    }

    const built = setupReadyEmail({
      matchCount,
      competitorDomain: state.competitorDomain,
    });
    await sendEmail({
      to: [user.email],
      subject: built.subject,
      html: built.html,
      text: built.text,
    });
  } catch {
    // Never let the notification take down the import.
  }
}

/** Mark setup complete so the user is never sent back to /welcome. */
export async function completeOnboarding(userId: string): Promise<void> {
  await db
    .update(schema.users)
    .set({ onboardedAt: new Date() })
    .where(eq(schema.users.id, userId));
  // The job rows have served their purpose; drop them so a later
  // "run setup again" starts clean.
  await db
    .delete(schema.onboardingJobs)
    .where(eq(schema.onboardingJobs.userId, userId));
}

/**
 * Validate a store URL and return its catalogue size.
 *
 * Onboarding needs the count before importing so the progress bar has a
 * denominator, and the same request doubles as the "is this a reachable
 * Shopify store?" check.
 */
export function parseStoreDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  let domain = trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "");
  domain = domain.split("/")[0].split("?")[0].split("#")[0];
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(domain)) return null;
  return domain;
}

export async function validateShopifyStore(
  rawUrl: string,
): Promise<{ ok: true; domain: string } | { ok: false; error: string }> {
  if (!rawUrl.trim()) {
    return { ok: false, error: "Enter a store address to continue." };
  }
  const domain = parseStoreDomain(rawUrl);
  if (!domain) {
    return {
      ok: false,
      error:
        "That doesn't look like a store address. Try something like mystore.com.",
    };
  }
  try {
    const res = await fetch(`https://${domain}/products.json?limit=1`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `We couldn't reach ${domain}. Check the address and try again.`,
      };
    }
    const data = (await res.json().catch(() => null)) as {
      products?: unknown[];
    } | null;
    if (!data || !Array.isArray(data.products)) {
      return {
        ok: false,
        error: `${domain} doesn't look like a Shopify store, so we can't read its prices.`,
      };
    }
    return { ok: true, domain };
  } catch {
    return {
      ok: false,
      error: `We couldn't reach ${domain}. Check the address and try again.`,
    };
  }
}

/** Products the user has already tracked, used to gate the last step. */
export async function countTrackedFromSetup(userId: string): Promise<number> {
  const [row] = await db.execute<{ n: number }>(sql`
    SELECT COUNT(*)::int AS n FROM tracked_products
    WHERE user_id = ${userId}::uuid AND group_id IS NOT NULL
  `);
  return row?.n ?? 0;
}
