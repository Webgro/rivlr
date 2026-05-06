import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";
import {
  getPlanForUser,
  getProductQuota,
  PLAN_FEATURES,
  type Plan,
} from "@/lib/plan";
import {
  isStripeConfigured,
  isOverageConfigured,
  MAX_OVERAGE_PACKS,
  PRODUCTS_PER_OVERAGE_PACK,
} from "@/lib/stripe";
import { getDefaultPaymentMethod } from "@/lib/billing";
import { QuotaBar } from "@/components/quota-bar";
import { OveragePackPicker } from "./overage-pack-picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing · Rivlr" };

const PACK_PRICE_GBP = 15;

interface PlanCard {
  id: Plan;
  name: string;
  price: string;
  priceNum: number; // for proration display
  cadenceLabel: string;
  bullets: string[];
  highlight?: boolean;
}

const PLAN_CARDS: PlanCard[] = [
  {
    id: "free",
    name: "Free",
    price: "£0",
    priceNum: 0,
    cadenceLabel: "Daily crawl",
    bullets: ["Up to 5 tracked products", "Daily cadence", "All core features"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "£14.99",
    priceNum: 14.99,
    cadenceLabel: "Daily crawl",
    bullets: [
      "Up to 50 tracked products",
      "Daily cadence",
      "Email alerts + weekly digest",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    price: "£29.99",
    priceNum: 29.99,
    cadenceLabel: "Every 6 hours",
    bullets: [
      "Up to 150 tracked products",
      "6-hourly cadence",
      "Compare view unlocked",
      "Multi-market price scan",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "£59.99",
    priceNum: 59.99,
    cadenceLabel: "Hourly crawl",
    highlight: true,
    bullets: [
      "Up to 400 tracked products",
      "Hourly cadence",
      "Compare view + multi-market",
      `Add overage packs: +${PRODUCTS_PER_OVERAGE_PACK} products for £${PACK_PRICE_GBP}/mo each`,
    ],
  },
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    reason?: string;
    blocked?: string;
    upgrade?: string;
    current?: string;
    target?: string;
    limit?: string;
    message?: string;
    packs?: string;
  }>;
}) {
  const user = await requireUser("/billing");
  const plan = await getPlanForUser(user.id);
  const stripeConfigured = isStripeConfigured();
  const overageConfigured = isOverageConfigured();
  const params = await searchParams;
  const quota = await getProductQuota(user.id);

  const [subscription] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, user.id))
    .limit(1);

  const hasSubscription = !!subscription;
  const overagePacks = subscription?.overagePacks ?? 0;
  const card = await getDefaultPaymentMethod(user.stripeCustomerId);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted">
          Choose the plan that matches your catalogue size and how fast you
          need new prices. Change anytime.
        </p>
      </header>

      {/* Status / reason banners. Driven by the redirect query string from
          /api/billing/* routes. */}
      <Banners params={params} />

      {/* Owner override — gives the founder account a clear "you don't pay" cue. */}
      {plan === "owner" && (
        <div className="mt-6 rounded-lg border border-default bg-elevated px-5 py-4 text-sm">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted/70 font-mono">
            Owner account
          </div>
          <div className="mt-1.5 font-medium">Billing is bypassed for this account.</div>
          <p className="mt-1 text-xs text-muted">
            You have unrestricted access regardless of subscription state.
          </p>
        </div>
      )}

      {!stripeConfigured && (
        <StatusBanner tone="muted">
          Billing isn&apos;t fully configured on this deployment yet — upgrade
          buttons are disabled. Add the Stripe env vars in Vercel to enable.
        </StatusBanner>
      )}

      {/* Active subscription summary — shown above the grid for current
          customers. Houses the plan badge, status pill, period info,
          card display, and account actions (update card, invoices,
          cancel / resume). */}
      {hasSubscription && plan !== "owner" && subscription && (
        <SubscriptionSummary
          plan={plan}
          status={subscription.status}
          currentPeriodEnd={subscription.currentPeriodEnd}
          cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
          card={card}
          overagePacks={overagePacks}
          stripeConfigured={stripeConfigured}
        />
      )}

      {/* Pro-tier overage controls. Only rendered when the user is
          actually on Pro AND the overage SKU is configured. */}
      {plan === "pro" && overageConfigured && (
        <OveragePackPicker
          currentPacks={overagePacks}
          maxPacks={MAX_OVERAGE_PACKS}
          packPriceGbp={PACK_PRICE_GBP}
          productsPerPack={PRODUCTS_PER_OVERAGE_PACK}
        />
      )}

      {plan === "pro" && !overageConfigured && (
        <StatusBanner tone="muted">
          Overage packs aren&apos;t configured on this deployment yet. Email
          support if you need to track more than 400 products on Pro.
        </StatusBanner>
      )}

      {/* Quota indicator — usable as upgrade prompt regardless of
          subscription state. Hidden for owner (unlimited). */}
      {plan !== "owner" && <QuotaBar quota={quota} className="mt-6" />}

      {/* Plan grid */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-tight">
          {hasSubscription ? "Switch plan" : "Choose a plan"}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {hasSubscription
            ? "Plan changes are prorated and charged immediately. Pro is the only tier that supports overage packs."
            : "Pick the plan that fits your catalogue. You'll go through Stripe Checkout to enter card details."}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_CARDS.map((card) => (
            <PlanCardComponent
              key={card.id}
              card={card}
              currentPlan={plan}
              currentProductCount={quota.current}
              stripeConfigured={stripeConfigured}
              hasSubscription={hasSubscription}
              cancelAtPeriodEnd={subscription?.cancelAtPeriodEnd ?? false}
            />
          ))}
        </div>
      </section>

      <p className="mt-10 text-xs text-muted leading-relaxed">
        Prices in GBP. Billed monthly. VAT added at checkout where applicable.
        {hasSubscription
          ? " Cancellation takes effect at the end of your current period — no immediate refund."
          : " Cancel any time once you've subscribed."}
      </p>
    </main>
  );
}

/* ─── Pieces ───────────────────────────────────────────────────────── */

function Banners({ params }: { params: { [k: string]: string | undefined } }) {
  if (params.status === "success") {
    return (
      <StatusBanner tone="ok">
        Checkout complete. Your plan will update within a minute once Stripe
        confirms the payment.
      </StatusBanner>
    );
  }
  if (params.status === "plan-updated") {
    return (
      <StatusBanner tone="ok">
        Plan updated. The change is reflected immediately; your next invoice
        includes the prorated amount.
      </StatusBanner>
    );
  }
  if (params.status === "overage-updated") {
    const packs = parseInt(params.packs ?? "0", 10);
    return (
      <StatusBanner tone="ok">
        Overage updated to {packs} pack{packs === 1 ? "" : "s"} (
        +{packs * PRODUCTS_PER_OVERAGE_PACK} products). Charged prorated to
        the rest of this billing period.
      </StatusBanner>
    );
  }
  if (params.status === "canceling") {
    return (
      <StatusBanner tone="warning">
        Cancellation scheduled. You keep full access until the end of the
        current period; click <strong>Resume</strong> below to undo.
      </StatusBanner>
    );
  }
  if (params.status === "resumed") {
    return (
      <StatusBanner tone="ok">
        Subscription resumed. Cancellation has been called off.
      </StatusBanner>
    );
  }
  if (params.status === "canceled") {
    return (
      <StatusBanner tone="muted">
        Checkout canceled. No charge made — pick a plan whenever you&apos;re
        ready.
      </StatusBanner>
    );
  }
  if (params.reason === "product-limit") {
    return (
      <StatusBanner tone="warning">
        You hit your plan&apos;s product limit
        {params.blocked && Number(params.blocked) > 0
          ? ` — ${params.blocked} item${Number(params.blocked) === 1 ? "" : "s"} couldn't be added.`
          : "."}{" "}
        Upgrade below to track more.
      </StatusBanner>
    );
  }
  if (params.reason === "downgrade-blocked") {
    return (
      <StatusBanner tone="warning">
        Can&apos;t downgrade to <strong>{params.target}</strong> — you&apos;re
        tracking {params.current} products and that plan caps at{" "}
        {params.limit}. Pause or remove products first, then try again.
      </StatusBanner>
    );
  }
  if (params.reason === "change-failed") {
    return (
      <StatusBanner tone="warning">
        Couldn&apos;t change plan: {params.message ?? "unknown error"}.
      </StatusBanner>
    );
  }
  if (params.reason === "cancel-failed" || params.reason === "resume-failed") {
    return (
      <StatusBanner tone="warning">
        {params.message ?? "Action failed."}
      </StatusBanner>
    );
  }
  if (params.reason === "overage-failed") {
    return (
      <StatusBanner tone="warning">
        Overage update failed: {params.message ?? "unknown error"}. The pack
        count was not changed.
      </StatusBanner>
    );
  }
  return null;
}

function SubscriptionSummary({
  plan,
  status,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  card,
  overagePacks,
  stripeConfigured,
}: {
  plan: Plan;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  card: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  overagePacks: number;
  stripeConfigured: boolean;
}) {
  const planCopy = plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1);
  const statusCopy =
    status === "active"
      ? "Active"
      : status === "trialing"
        ? "On trial"
        : status === "past_due"
          ? "Past due"
          : status === "canceled"
            ? "Canceled"
            : status.charAt(0).toUpperCase() + status.slice(1);
  const dateLabel = cancelAtPeriodEnd
    ? "Access ends"
    : status === "canceled"
      ? "Ended"
      : "Renews";

  return (
    <section className="mt-6 rounded-xl border border-default bg-elevated p-5">
      {/* Header row: plan + status */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted/70 font-mono">
            Current plan
          </div>
          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            <span className="text-lg font-semibold tracking-tight">
              {planCopy}
            </span>
            {plan === "pro" && overagePacks > 0 && (
              <span className="rounded bg-foreground/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-strong font-mono">
                +{overagePacks} pack{overagePacks === 1 ? "" : "s"}
              </span>
            )}
            <span
              className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] font-mono ${
                status === "active" || status === "trialing"
                  ? "bg-green-500/15 text-green-500"
                  : status === "past_due"
                    ? "bg-signal/15 text-signal"
                    : "bg-surface text-muted border border-default"
              }`}
            >
              {statusCopy}
            </span>
            {cancelAtPeriodEnd && (
              <span className="rounded bg-signal/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-signal font-mono">
                Cancels at period end
              </span>
            )}
          </div>
          {currentPeriodEnd && (
            <div className="mt-1 text-xs text-muted">
              {dateLabel}{" "}
              {currentPeriodEnd.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          )}
        </div>

        {/* Cancel / Resume action */}
        {cancelAtPeriodEnd ? (
          <form
            action="/api/billing/resume"
            method="post"
            className="flex-shrink-0"
          >
            <button
              type="submit"
              disabled={!stripeConfigured}
              className="rounded-md border border-default bg-surface px-3.5 py-1.5 text-xs font-medium text-foreground hover:border-strong transition disabled:opacity-50"
            >
              Resume subscription
            </button>
          </form>
        ) : (
          <form
            action="/api/billing/cancel"
            method="post"
            className="flex-shrink-0"
          >
            <button
              type="submit"
              disabled={!stripeConfigured}
              className="rounded-md border border-default bg-surface px-3.5 py-1.5 text-xs font-medium text-muted hover:text-signal hover:border-signal/50 transition disabled:opacity-50"
              title="Schedule cancellation at the end of the current billing period."
            >
              Cancel plan
            </button>
          </form>
        )}
      </div>

      {/* Card row */}
      <div className="mt-5 pt-4 border-t border-default flex items-center justify-between gap-4 flex-wrap">
        <div className="text-xs">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted/70 font-mono">
            Card on file
          </span>
          <div className="mt-1 font-mono text-foreground">
            {card ? (
              <>
                {card.brand.toUpperCase()} •••• {card.last4}{" "}
                <span className="text-muted">
                  exp {String(card.expMonth).padStart(2, "0")}/
                  {String(card.expYear).slice(-2)}
                </span>
              </>
            ) : (
              <span className="text-muted">No card on file</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <form action="/api/billing/portal" method="post">
            <input type="hidden" name="flow" value="update-card" />
            <button
              type="submit"
              disabled={!stripeConfigured}
              className="rounded-md border border-default bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-strong transition disabled:opacity-50"
            >
              {card ? "Update card" : "Add card"} →
            </button>
          </form>
          <form action="/api/billing/portal" method="post">
            <input type="hidden" name="flow" value="invoices" />
            <button
              type="submit"
              disabled={!stripeConfigured}
              className="rounded-md border border-default bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-strong transition disabled:opacity-50"
            >
              Invoices →
            </button>
          </form>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted/80 leading-relaxed">
        Card updates and invoice history are handled by Stripe&apos;s hosted
        billing portal so card details never touch our servers. Plan
        changes and cancellation happen here.
      </p>
    </section>
  );
}

function PlanCardComponent({
  card,
  currentPlan,
  currentProductCount,
  stripeConfigured,
  hasSubscription,
  cancelAtPeriodEnd,
}: {
  card: PlanCard;
  currentPlan: Plan;
  currentProductCount: number;
  stripeConfigured: boolean;
  hasSubscription: boolean;
  cancelAtPeriodEnd: boolean;
}) {
  const isCurrent = currentPlan === card.id;
  const isOwner = currentPlan === "owner";
  const isPaid = card.id !== "free";

  // Downgrade pre-flight: would the user's current product count fit?
  // We don't *block* the click here (server enforces) but we mark the
  // card so the user knows in advance.
  const targetBase = PLAN_FEATURES[card.id].productLimit;
  const wouldNotFit =
    !isCurrent &&
    !isOwner &&
    isPaid &&
    targetBase !== null &&
    currentProductCount > targetBase;

  // For the in-app plan switch flow we POST to /api/billing/change-plan;
  // for first-time signups (no subscription yet) we keep using Checkout.
  const action = hasSubscription
    ? "/api/billing/change-plan"
    : "/api/billing/checkout";

  return (
    <div
      className={`relative flex flex-col rounded-xl border p-5 ${
        card.highlight
          ? "border-signal/50 bg-signal/[0.03]"
          : "border-default bg-elevated"
      } ${isCurrent ? "ring-1 ring-signal" : ""}`}
    >
      {card.highlight && !isCurrent && (
        <span className="absolute -top-2 right-4 rounded bg-signal px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-white font-mono">
          Most popular
        </span>
      )}

      <div className="text-sm font-semibold">{card.name}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight">
          {card.price}
        </span>
        {isPaid && <span className="text-xs text-muted">/ month</span>}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted/70 font-mono">
        {card.cadenceLabel}
      </div>

      <ul className="mt-4 space-y-1.5 text-xs text-muted leading-relaxed">
        {card.bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-signal">✓</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 pt-4 border-t border-default">
        {isCurrent && !isOwner ? (
          <div className="text-center text-xs uppercase tracking-[0.18em] text-signal font-mono py-2">
            {cancelAtPeriodEnd ? "Current · ending" : "Current plan"}
          </div>
        ) : isOwner ? (
          <div className="text-center text-[11px] text-muted/70 py-2">
            Reference only
          </div>
        ) : !isPaid ? (
          // Free tier — only reachable via cancellation, can't be
          // "switched to" since there's no Stripe transition.
          hasSubscription ? (
            <div className="text-center text-[11px] text-muted py-2">
              Cancel to drop to Free
            </div>
          ) : (
            <div className="text-center text-[11px] text-muted py-2">
              Default plan
            </div>
          )
        ) : (
          <form action={action} method="post">
            <input type="hidden" name="plan" value={card.id} />
            <button
              type="submit"
              disabled={!stripeConfigured || wouldNotFit}
              title={
                wouldNotFit
                  ? `You're tracking ${currentProductCount} products. Reduce to ${targetBase} or fewer to switch to ${card.name}.`
                  : undefined
              }
              className={`w-full rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                card.highlight
                  ? "bg-signal text-white hover:bg-red-600"
                  : "bg-foreground text-surface hover:opacity-90"
              }`}
            >
              {wouldNotFit
                ? "Too many products"
                : hasSubscription
                  ? `Switch to ${card.name} →`
                  : currentPlan === "free"
                    ? "Choose plan →"
                    : `Switch plan →`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function StatusBanner({
  tone,
  children,
}: {
  tone: "ok" | "muted" | "warning";
  children: React.ReactNode;
}) {
  const styles =
    tone === "ok"
      ? "border-green-500/30 bg-green-500/[0.04] text-foreground"
      : tone === "warning"
        ? "border-amber-500/40 bg-amber-500/[0.05] text-foreground"
        : "border-default bg-elevated text-muted";
  return <div className={`mt-6 rounded-lg border px-5 py-4 text-sm ${styles}`}>{children}</div>;
}
