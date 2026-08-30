import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getOnboardingState, parseStoreDomain } from "@/lib/onboarding";
import { findCatalogueMatches } from "@/lib/matching";
import { getProductQuota } from "@/lib/plan";
import { SetupShell } from "./setup-shell";
import { StoreForm } from "./store-form";
import { ImportingStep } from "./importing-step";
import { LinkStep } from "./link-step";
import {
  finishSetupAndGo,
  skipStoreStep,
  submitCompetitor,
  submitOwnStore,
} from "./actions";

export const metadata: Metadata = {
  title: "Set up Rivlr",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Guided setup.
 *
 * One route for all four steps, with the step derived from the database
 * (see lib/onboarding.ts) rather than carried in the URL, so refreshing,
 * going back, or returning tomorrow all land in the right place.
 */
export default async function WelcomePage(props: {
  searchParams: Promise<{ store?: string }>;
}) {
  const user = await requireUser();
  const [state, { store }] = await Promise.all([
    getOnboardingState(user.id),
    props.searchParams,
  ]);
  // Re-parsed rather than trusted: it arrives via the magic link's
  // redirect and is about to be rendered into an input.
  const prefilledStore = parseStoreDomain(store ?? "") ?? "";

  if (state.step === "done") redirect("/dashboard");

  if (state.step === "store") {
    return (
      <SetupShell
        current="store"
        title="What's your store address?"
        subtitle="We'll read your product list so we can show you what competitors charge for the same things."
      >
        <StoreForm
          action={submitOwnStore}
          label="Continue"
          placeholder="mystore.com"
          initialValue={prefilledStore}
        />
        <form action={skipStoreStep} className="mt-4">
          <button
            type="submit"
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            I don&apos;t have a store yet
          </button>
        </form>
        <p className="mt-6 text-xs text-neutral-600">
          Works with any Shopify store. Nothing to install, and we only read
          what shoppers can already see.
        </p>
      </SetupShell>
    );
  }

  if (state.step === "competitor") {
    return (
      <SetupShell
        current="competitor"
        title="Who do you want to watch?"
        subtitle="Add one competitor to start. You can add more later."
      >
        <StoreForm
          action={submitCompetitor}
          label="Continue"
          placeholder="acompetitor.com"
        />
        <p className="mt-6 text-xs text-neutral-600">
          Pick the one whose prices you check most often.
        </p>
      </SetupShell>
    );
  }

  if (state.step === "importing") {
    return (
      <SetupShell
        current="importing"
        title="Reading the prices"
        subtitle="Hold on a moment while we fetch both product lists."
      >
        <ImportingStep initial={state} />
      </SetupShell>
    );
  }

  // step === "link"
  const competitorDomain = state.competitorDomain ?? "";

  // Without the user's own catalogue there is nothing to match against,
  // so this step has no matches to offer. It must still end setup
  // explicitly rather than redirecting away: the app layout sends
  // anyone whose setup is unfinished back here, so a bare redirect to
  // the dashboard bounces straight back and loops.
  if (!state.myDomain || !competitorDomain) {
    const staged = state.competitor?.imported ?? 0;
    return (
      <SetupShell
        current="link"
        title="Ready when you are"
        subtitle={
          staged > 0 ? (
            <>
              We&apos;ve read {staged.toLocaleString()} products from{" "}
              <span className="text-paper">{competitorDomain}</span>. Add your
              own store later and we&apos;ll match them up for you
              automatically.
            </>
          ) : (
            "Add products from the Discover page whenever you're ready."
          )
        }
        exitLabel="Go to dashboard"
      >
        <FinishButton label="Pick products to track" href="/discover" />
      </SetupShell>
    );
  }

  // Deliberately more matches than the plan allows anyone to track.
  //
  // Showing exactly the plan's allowance made the limit invisible: five
  // rows, all of them tickable, and no sense that a choice was being
  // made. Fifteen shows the overlap that was actually found, lets the
  // user pick the five that matter to them rather than the five we
  // happened to rank first, and makes the ceiling something they meet
  // honestly rather than something we hide.
  const SHOWN_MATCHES = 15;
  const quota = await getProductQuota(user.id);
  const matches = await findCatalogueMatches({
    userId: user.id,
    competitorDomain,
    limit: SHOWN_MATCHES,
  });
  const maxSelectable =
    quota.limit === null
      ? SHOWN_MATCHES
      : Math.max(0, quota.remaining ?? 0);

  if (matches.length === 0) {
    return (
      <SetupShell
        current="link"
        title="No overlap yet"
        subtitle={
          <>
            We couldn&apos;t find products that both you and{" "}
            <span className="text-paper">{competitorDomain}</span> sell. That
            usually means they stock different lines, or their product names
            are written very differently to yours.
          </>
        }
        exitLabel="Skip setup"
      >
        <FinishButton label="Pick products by hand" href="/products/new" />
        <p className="mt-6 text-xs text-neutral-600">
          You can also add another competitor from the Stores page.
        </p>
      </SetupShell>
    );
  }

  return (
    <SetupShell
      current="link"
      title={`${matches.length} of your products are on ${competitorDomain}`}
      subtitle={
        maxSelectable > 0
          ? `Choose up to ${maxSelectable} to watch. We'll email you when their price or stock changes.`
          : "You're at your plan's limit, so there's nothing to add right now."
      }
    >
      <LinkStep
        matches={matches}
        competitorDomain={competitorDomain}
        maxSelectable={maxSelectable}
        isFreePlan={quota.plan === "free"}
      />
    </SetupShell>
  );
}

/**
 * Leaves setup by way of the action that marks it complete, so the app
 * layout doesn't send the user straight back here.
 */
function FinishButton({ label, href }: { label: string; href: string }) {
  return (
    <form action={finishSetupAndGo}>
      <input type="hidden" name="to" value={href} />
      <button
        type="submit"
        className="rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-black hover:bg-signal/90"
      >
        {label}
      </button>
    </form>
  );
}
