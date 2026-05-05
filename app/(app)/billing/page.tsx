import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { getPlanForUser, type Plan } from "@/lib/plan";
import { isStripeConfigured } from "@/lib/stripe";

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
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser("/billing");
  const plan = await getPlanForUser(user.id);
  const stripeConfigured = isStripeConfigured();
  const params = await searchParams;

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
      {params.status === "success" && <StatusBanner tone="ok">
        Checkout complete. Your plan will update within a minute once Stripe
        confirms the payment.
      </StatusBanner>}
      {params.status === "canceled" && <StatusBanner tone="muted">
        Checkout canceled. No charge made — you can pick a plan whenever
        you&apos;re ready.
      </StatusBanner>}

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

      {/* Plan grid */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLAN_CARDS.map((card) => (
          <PlanCardComponent
            key={card.id}
            card={card}
            currentPlan={plan}
            stripeConfigured={stripeConfigured}
          />
        ))}
      </section>

      <p className="mt-10 text-xs text-muted leading-relaxed">
        Prices in GBP. Billed monthly. VAT added at checkout where applicable.
        Cancel any time from{" "}
        <Link
          href="/billing"
          className="text-foreground underline-offset-4 hover:underline"
        >
          this page
        </Link>{" "}
        — your access continues until the end of the period you&apos;ve paid for.
      </p>
    </main>
  );
}

function PlanCardComponent({
  card,
  currentPlan,
  stripeConfigured,
}: {
  card: PlanCard;
  currentPlan: Plan;
  stripeConfigured: boolean;
}) {
  const isCurrent = currentPlan === card.id;
  // Owner bypasses billing → every plan shows as "reference only".
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
  tone: "ok" | "muted";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-6 rounded-lg border px-5 py-4 text-sm ${
        tone === "ok"
          ? "border-green-500/30 bg-green-500/[0.04] text-foreground"
          : "border-default bg-elevated text-muted"
      }`}
    >
      {children}
    </div>
  );
}
