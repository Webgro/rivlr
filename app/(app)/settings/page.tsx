import Link from "next/link";
import {
  saveNotificationEmails,
  getSettings,
  updateMultiMarketCountries,
  updateCartProbeEnabled,
  updateDaysCoverThreshold,
} from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ToggleSwitch } from "@/components/toggle-switch";
import { ThemeToggle } from "@/components/theme-toggle";
import { SendTestEmailButton } from "./send-test-email-button";
import { PLAN_FEATURES, CADENCE_LABELS, getCurrentPlan } from "@/lib/plan";
import { KNOWN_MARKETS } from "@/lib/crawler/multi-market";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Rivlr" };

/**
 * Settings — app-wide configuration shared by the whole account.
 *
 * Two sections: Crawling and Alerts. Identity / team / sign-out lives on
 * /profile. Sticky pill nav at top of the content lets the user jump.
 *
 * CTA hygiene:
 *  - Toggles auto-save (no button).
 *  - The remaining forms each have a single, identically-styled "Save"
 *    button right-aligned inside the card. Keeps the button count low
 *    and the visual rhythm consistent.
 */
export default async function SettingsPage() {
  const settings = await getSettings();
  const plan = await getCurrentPlan();
  const current = (settings?.notificationEmails ?? []).join(", ");
  // Cadence is automatic per plan — surfaced read-only for clarity.
  const cadence = PLAN_FEATURES[plan].cadence;
  const currentCountries = settings?.multiMarketCountries ?? [
    "GB",
    "IE",
    "US",
    "DE",
    "AU",
    "CA",
    "JP",
  ];
  const cartProbeEnabled = settings?.cartProbeEnabled ?? true;
  const daysCoverThreshold = settings?.daysCoverThreshold ?? 7;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          App-wide configuration. Account, sign-in access, and team are on{" "}
          <Link
            href="/profile"
            className="text-foreground underline-offset-4 hover:underline"
          >
            Profile
          </Link>
          .
        </p>
      </header>

      {/* Sticky pill nav — quick links to each section. */}
      <nav className="sticky top-0 z-10 -mx-6 px-6 mt-6 py-3 bg-surface/90 backdrop-blur border-b border-default flex flex-wrap gap-2 text-xs">
        <SectionLink href="#crawling" label="Checks" />
        <SectionLink href="#alerts" label="Alerts" />
        <SectionLink href="#appearance" label="Appearance" />
        <Link
          href="/billing"
          className="ml-auto self-center text-[11px] font-medium text-muted hover:text-foreground transition"
          title="Manage plan"
        >
          Plan: <span className="text-muted">{plan}</span>
        </Link>
      </nav>

      {/* ═══ CRAWLING ════════════════════════════════════════════════ */}
      <SectionHeading id="crawling" title="Checks" />

      {/* Cadence is set automatically by plan — no control, just a
          statement of fact with an upgrade path. */}
      <Card
        title="How often Rivlr checks"
        description="How often every tracked product is re-checked. This is set by your plan."
      >
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-md border border-default bg-surface px-4 py-3">
          <div>
            <span className="text-sm font-semibold">
              {CADENCE_LABELS[cadence]}
            </span>
            <span className="ml-2 text-xs text-muted">
              on your {plan} plan
            </span>
          </div>
          {cadence !== "hourly" && (
            <Link
              href="/billing"
              className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
            >
              Upgrade for faster checks
            </Link>
          )}
        </div>
      </Card>

      <Card
        title="Prices in other countries"
        description="Choose which countries Rivlr checks prices in. These run once a day and show on each product page."
      >
        <form action={updateMultiMarketCountries}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(KNOWN_MARKETS).map(([code, m]) => {
              const checked = currentCountries.includes(code);
              return (
                <label
                  key={code}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer transition ${
                    checked
                      ? "border-signal/40 bg-signal/[0.04]"
                      : "border-default bg-surface hover:border-strong"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="country"
                    value={code}
                    defaultChecked={checked}
                    className="accent-signal"
                  />
                  <span className="text-sm">
                    <span className="font-mono text-muted">{code}</span>{" "}
                    <span>{m.label}</span>
                  </span>
                  <span className="ml-auto text-[10px] text-muted font-mono">
                    {m.currency}
                  </span>
                </label>
              );
            })}
          </div>
          <CardFooter
            hint="Tip: only tick countries your competitors actually sell in."
          >
            <SaveButton />
          </CardFooter>
        </form>
      </Card>

      <Card
        title="Exact stock check"
        description={
          <>
            Some stores show only &quot;In stock&quot; with no number. Once a
            day, Rivlr can check those products for the exact quantity, the
            same way a shopper&apos;s basket would see it. Nothing is ever
            bought. Read more on the{" "}
            <Link
              href="/bot"
              className="text-foreground underline-offset-4 hover:underline"
            >
              bot info page
            </Link>
            .
          </>
        }
      >
        <form
          action={updateCartProbeEnabled}
          className="flex items-center justify-between gap-4"
        >
          <div>
            <div className="text-sm font-medium">
              Check exact stock daily
            </div>
            <div className="mt-1 text-xs text-muted">
              {cartProbeEnabled
                ? "On. Rivlr finds the exact number whenever it can."
                : "Off. Rivlr only uses the stock numbers stores share openly."}
            </div>
          </div>
          <input
            type="hidden"
            name="enabled"
            value={(!cartProbeEnabled).toString()}
          />
          <ToggleSwitch
            type="submit"
            checked={cartProbeEnabled}
            size="lg"
            ariaLabel="Check exact stock daily"
          />
        </form>
      </Card>

      {/* ═══ ALERTS ══════════════════════════════════════════════════ */}
      <SectionHeading id="alerts" title="Alerts" />

      <Card
        title="Notification emails"
        description="Where to send price-drop, stock-change and low-stock alerts. Separate addresses with commas. You'll never get the same alert twice in one day."
      >
        <form action={saveNotificationEmails} className="space-y-3">
          <textarea
            name="emails"
            defaultValue={current}
            rows={3}
            placeholder="you@example.com, partner@example.com"
            className="block w-full rounded-md border border-default bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-foreground"
          />
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <SendTestEmailButton hasRecipients={current.length > 0} />
            <SaveButton />
          </div>
        </form>
        <p className="mt-3 text-[11px] text-muted/80 leading-relaxed">
          One-click unsubscribe in every email · weekly summary every Monday
          morning · low-stock warnings each morning.
        </p>
      </Card>

      <Card
        title="Days-cover warning threshold"
        description="Surface competitor products on the Opportunities page when their remaining stock divided by their daily sales velocity drops below this many days. Lower = earlier warning, fewer matches."
      >
        <form
          action={updateDaysCoverThreshold}
          className="flex items-center gap-3 flex-wrap"
        >
          <label className="text-sm flex items-center gap-2">
            Warn when days cover &lt;
            <input
              type="number"
              name="threshold"
              defaultValue={daysCoverThreshold}
              min={1}
              max={90}
              step={1}
              className="w-20 rounded-md border border-default bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus:border-strong"
            />
            days
          </label>
          <span className="ml-auto" />
          <SaveButton />
        </form>
      </Card>

      {/* ═══ APPEARANCE ══════════════════════════════════════════════ */}
      <SectionHeading id="appearance" title="Appearance" />

      <Card
        title="Theme"
        description="Choose between light and dark mode. Saved per-browser, applied immediately."
      >
        <ThemeToggle />
      </Card>

      <p className="mt-12 text-xs text-muted font-mono">
        {settings
          ? `Last saved ${new Date(settings.updatedAt).toLocaleString()}`
          : "Not yet configured"}
      </p>
    </main>
  );
}

/* ─── Layout primitives ──────────────────────────────────────────── */

function SectionLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="rounded-md border border-default bg-elevated px-3 py-1.5 hover:border-strong transition"
    >
      {label}
    </a>
  );
}

function SectionHeading({ id, title }: { id: string; title: string }) {
  return (
    <div id={id} className="mt-12 pt-1 scroll-mt-20">
      <div className="text-xs font-medium text-muted">
        {title}
      </div>
    </div>
  );
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5 rounded-lg border border-default bg-elevated p-5">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 text-xs text-muted leading-relaxed">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function CardFooter({
  hint,
  children,
}: {
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
      {hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : (
        <span />
      )}
      {children}
    </div>
  );
}

function SaveButton() {
  return (
    <SubmitButton
      className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition disabled:opacity-50"
      pendingLabel="Saving…"
    >
      Save
    </SubmitButton>
  );
}

