import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";
import { getPlanForUser, getProductQuota, type Plan } from "@/lib/plan";
import { isStripeConfigured } from "@/lib/stripe";
import { QuotaBar } from "@/components/quota-bar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing · Rivlr" };

interface PlanCard {
  id: Plan;
  name: string;
  price: string;
  cadenceLabel: string;
  bullets: string[];
  highlight?: boolean;
}

const PLAN_CARDS: PlanCard[] = [
  {
    id: "free",
    name: "Free",
    price: "£0",
    cadenceLabel: "Daily crawl",
    bullets: ["Up to 5 tracked products", "Daily cadence", "All core features"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "£14.99",
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
    cadenceLabel: "Every 6 hours",
    highlight: true,
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
    cadenceLabel: "Hourly crawl",
    bullets: [
      "Up to 400 tracked products",
      "Hourly cadence",
      "Compare view + multi-market",
      "Priority crawl + support",
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
  }>;
}) {
  const user = await requireUser("/billing");
  const plan = await getPlanForUser(user.id);
  const stripeConfigured = isStripeConfigured();
  const params = await searchParams;
  const quota = await getProductQuota(user.id);

  // Look up the persisted subscription row (populated by webhooks in
  // Stage 4). Its presence is the signal that the user has an existing
  // Stripe subscription that should be managed via the Portal rather
  // than starting fresh through Checkout.
  const [subscription] = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, user.id))
    .limit(1);

  const hasSubscription = !!subscription;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted">
          Choose the plan that matches your catalogue size and how fast you
          need new prices. Change anytime.
        </p>
      </header>

      {/* Status banner — Checkout success/cancel returns the user here. */}
      {params.status === "success" && (
        <StatusBanner tone="ok">
          Checkout complete. Your plan will update within a minute once Stripe
          confirms the payment.
        </StatusBanner>
      )}
      {params.status === "canceled" && (
        <StatusBanner tone="muted">
          Checkout canceled. No charge made — you can pick a plan whenever
          you&apos;re ready.
        </StatusBanner>
      )}

      {/* Hard-redirect from /products/new when the user hit their cap. */}
      {params.reason === "product-limit" && (
        <StatusBanner tone="warning">
          You&apos;re at the {quota.limit ?? "—"}-product limit on your{" "}
          <strong>{plan}</strong> plan
          {params.blocked && Number(params.blocked) > 0
            ? ` — ${params.blocked} item${Number(params.blocked) === 1 ? "" : "s"} couldn't be added.`
            : "."}{" "}
          Upgrade below to track more.
        </StatusBanner>
      )}

      {/* Owner override — gives the founder account a clear "you don't pay" cue
          and hides upgrade buttons. */}
      {plan === "owner" && (
        <div className="mt-6 rounded-lg border border-default bg-elevated px-5 py-4 text-sm">
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted/70 font-mono">
            Owner account
          </div>
          <div className="mt-1.5 font-medium">Billing is bypassed for this account.</div>
          <p className="mt-1 text-xs text-muted">
            You have unrestricted access regardless of subscription state.
            The plan grid below is shown for reference.
          </p>
        </div>
      )}

      {!stripeConfigured && (
        <StatusBanner tone="muted">
          Billing isn&apos;t fully configured on this deployment yet — upgrade
          buttons are disabled. Add the Stripe env vars in Vercel to enable.
        </StatusBanner>
      )}

      {/* Active-subscription summary card. Shown above the grid when the
          user has a persisted subscription; the grid below becomes a
          read-only comparison and plan changes route through the Portal. */}
      {hasSubscription && plan !== "owner" && (
        <SubscriptionSummary
          plan={plan}
          status={subscription.status}
          currentPeriodEnd={subscription.currentPeriodEnd}
          cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
          stripeConfigured={stripeConfigured}
        />
      )}

      {/* Quota indicator — usable as upgrade prompt regardless of
          subscription state. Hidden for owner (unlimited). */}
      {plan !== "owner" && <QuotaBar quota={quota} className="mt-6" />}

      {/* Plan grid */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_CARDS.map((card) => (
          <PlanCardComponent
            key={card.id}
            card={card}
            currentPlan={plan}
            stripeConfigured={stripeConfigured}
            hasSubscription={hasSubscription}
          />
        ))}
      </section>

      <p className="mt-10 text-xs text-muted leading-relaxed">
        Prices in GBP. Billed monthly. VAT added at checkout where applicable.
        {hasSubscription
          ? " Manage your card, switch plans, and cancel from the billing portal above — your access continues until the end of the period you've paid for."
          : " Cancel any time once you've subscribed — your access continues until the end of the period you've paid for."}
      </p>
    </main>
  );
}

function SubscriptionSummary({
  plan,
  status,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  stripeConfigured,
}: {
  plan: Plan;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  stripeConfigured: boolean;
}) {
  const planCopy = plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1);
  // Status copy. Stripe uses lowercase strings; we'd rather show
  // "Past due" than "past_due" to a human.
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted/70 font-mono">
            Current plan
          </div>
          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            <span className="text-lg font-semibold tracking-tight">
              {planCopy}
            </span>
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

        <form
          action="/api/billing/portal"
          method="post"
          className="flex-shrink-0"
        >
          <button
            type="submit"
            disabled={!stripeConfigured}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Manage billing →
          </button>
        </form>
      </div>

      <p className="mt-4 pt-4 border-t border-default text-[11px] text-muted leading-relaxed">
        Update your card, switch plans, view invoices, or cancel — all
        handled by Stripe&apos;s hosted billing portal. We never see your
        card details.
      </p>
    </section>
  );
}

function PlanCardComponent({
  card,
  currentPlan,
  stripeConfigured,
  hasSubscription,
}: {
  card: PlanCard;
  currentPlan: Plan;
  stripeConfigured: boolean;
  hasSubscription: boolean;
}) {
  const isCurrent = currentPlan === card.id;
  const isOwner = currentPlan === "owner";
  const isPaid = card.id !== "free";

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
            Current plan
          </div>
        ) : isOwner ? (
          <div className="text-center text-[11px] text-muted/70 py-2">
            Reference only
          </div>
        ) : !isPaid ? (
          <div className="text-center text-[11px] text-muted py-2">
            Default plan
          </div>
        ) : hasSubscription ? (
          // Existing subscriber — plan changes go through the Portal,
          // not a fresh Checkout. The summary card above hosts the CTA.
          <div className="text-center text-[11px] text-muted py-2">
            Switch via Manage billing
          </div>
        ) : (
          <form action="/api/billing/checkout" method="post">
            <input type="hidden" name="plan" value={card.id} />
            <button
              type="submit"
              disabled={!stripeConfigured}
              className={`w-full rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
                card.highlight
                  ? "bg-signal text-white hover:bg-red-600"
                  : "bg-foreground text-surface hover:opacity-90"
              }`}
            >
              {currentPlan === "free" ? "Choose plan" : "Switch plan"} →
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
