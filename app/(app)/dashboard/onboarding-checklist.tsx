import Link from "next/link";
import { db, schema } from "@/lib/db";
import { sql, eq } from "drizzle-orm";

interface Step {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  done: boolean;
}

/**
 * Five-step onboarding checklist for the dashboard. Each step's completion
 * is derived from real data — no separate "dismissed" state needed. When
 * all five are complete the widget renders nothing and gets out of the way.
 *
 * Plain English copy throughout — assumes no Shopify or DTC familiarity.
 */
export async function OnboardingChecklist() {
  const steps = await loadSteps();
  const doneCount = steps.filter((s) => s.done).length;

  // Auto-hide once everything is ticked.
  if (doneCount === steps.length) return null;

  // Find the next thing the user hasn't done — surfaced more prominently.
  const nextStep = steps.find((s) => !s.done);

  return (
    <section className="mt-6 rounded-xl border border-default bg-elevated overflow-hidden">
      <div className="px-5 py-4 border-b border-default flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">
              Getting started
            </h2>
            <span className="rounded-full bg-surface border border-default px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted font-mono">
              {doneCount} of {steps.length} done
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Five quick steps to get the most out of Rivlr. This panel
            disappears on its own once everything&apos;s set up.
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 min-w-[140px]">
          <div className="h-1.5 flex-1 rounded-full bg-surface overflow-hidden border border-default">
            <div
              className="h-full bg-signal transition-all duration-500"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="divide-y divide-default">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={`flex items-start gap-4 px-5 py-4 ${
              step.done ? "opacity-50" : ""
            } ${nextStep?.id === step.id ? "bg-signal/[0.03]" : ""}`}
          >
            {/* Numbered circle / tick */}
            <div className="flex-shrink-0 mt-0.5">
              {step.done ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500/15 text-green-500">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12 L10 17 L19 7" />
                  </svg>
                </span>
              ) : (
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-mono ${
                    nextStep?.id === step.id
                      ? "border-signal bg-signal/15 text-signal"
                      : "border-default text-muted"
                  }`}
                >
                  {i + 1}
                </span>
              )}
            </div>

            {/* Title + description */}
            <div className="min-w-0 flex-1">
              <div
                className={`text-sm font-medium ${step.done ? "line-through" : ""}`}
              >
                {step.title}
              </div>
              <div className="mt-1 text-xs text-muted leading-relaxed">
                {step.description}
              </div>
            </div>

            {/* CTA */}
            {!step.done && (
              <Link
                href={step.ctaHref}
                className={`flex-shrink-0 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                  nextStep?.id === step.id
                    ? "bg-signal text-white hover:bg-red-600"
                    : "border border-default bg-surface text-foreground hover:border-strong"
                }`}
              >
                {step.ctaLabel} →
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

async function loadSteps(): Promise<Step[]> {
  // Cheapest possible — single SQL pass for completion bits.
  const [row] = await db.execute<{
    has_product: boolean;
    has_my_store: boolean;
    has_link: boolean;
    has_emails: boolean;
    has_favourite: boolean;
  }>(sql`
    SELECT
      EXISTS (SELECT 1 FROM tracked_products WHERE active = true) AS has_product,
      EXISTS (SELECT 1 FROM stores WHERE is_my_store = true) AS has_my_store,
      EXISTS (
        SELECT 1 FROM tracked_products t1
        JOIN tracked_products t2
          ON t1.group_id = t2.group_id
         AND t1.id != t2.id
         AND t1.store_domain != t2.store_domain
        WHERE t1.group_id IS NOT NULL
      ) AS has_link,
      EXISTS (
        SELECT 1 FROM app_settings
        WHERE id = 'singleton'
          AND array_length(notification_emails, 1) > 0
      ) AS has_emails,
      EXISTS (SELECT 1 FROM tracked_products WHERE is_favourite = true) AS has_favourite
  `);

  return [
    {
      id: "track",
      title: "Track your first competitor product",
      description:
        "Paste a Shopify product URL — or a whole collection — and Rivlr starts watching the price and stock for you. You can add as many as your plan allows.",
      ctaLabel: "Add products",
      ctaHref: "/products/new",
      done: !!row?.has_product,
    },
    {
      id: "my-store",
      title: "Mark your own store",
      description:
        "Add the store you sell on the same way you added competitors, then tap 'Mark as my store' on its profile page. This unlocks the Opportunities view that shows where you're losing on price.",
      ctaLabel: "Choose store",
      ctaHref: "/stores",
      done: !!row?.has_my_store,
    },
    {
      id: "link",
      title: "Link a product to a competitor",
      description:
        "Tell Rivlr that two products are the same item across different stores so it can compare them side by side. We auto-suggest matches — you just confirm.",
      ctaLabel: "Review suggestions",
      ctaHref: "/products/suggestions",
      done: !!row?.has_link,
    },
    {
      id: "favourite",
      title: "Star a favourite",
      description:
        "Tap the star next to any product you care most about. Favourites are easier to find later from the Products page.",
      ctaLabel: "Open products",
      ctaHref: "/products",
      done: !!row?.has_favourite,
    },
    {
      id: "emails",
      title: "Add a notification email",
      description:
        "Where should we send price-drop and stock-change alerts? Pop your email into Settings — you can add more than one if you'd like a teammate to get them too.",
      ctaLabel: "Open settings",
      ctaHref: "/settings",
      done: !!row?.has_emails,
    },
  ];
}
