import Link from "next/link";
import {
  saveNotificationEmails,
  getSettings,
  updateCrawlCadence,
  updateMultiMarketCountries,
  updateCartProbeEnabled,
  updateDaysCoverThreshold,
} from "./actions";
import { SubmitButton } from "@/components/submit-button";
import {
  PLAN_FEATURES,
  CADENCE_LABELS,
  isCadenceAllowed,
  getCurrentPlan,
  type Cadence,
  type Plan,
} from "@/lib/plan";
import { KNOWN_MARKETS } from "@/lib/crawler/multi-market";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();
  const current = (settings?.notificationEmails ?? []).join(", ");
  const plan = await getCurrentPlan();
  const currentCadence: Cadence =
    (settings?.crawlCadence as Cadence) ?? PLAN_FEATURES[plan].cadence;
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Plan: <span className="font-mono uppercase">{plan}</span>.
        </p>
      </div>

      {/* Crawl cadence */}
      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wider font-mono text-muted">
          Crawl cadence
        </h2>
        <p className="mt-2 text-sm text-muted">
          How often Rivlr re-checks every tracked product for price and stock
          changes. Faster cadences mean earlier alerts; cost more compute.
        </p>
        <form action={updateCrawlCadence} className="mt-4 grid gap-3 sm:grid-cols-3">
          {(["daily", "every-6h", "hourly"] as Cadence[]).map((c) => (
            <CadenceCard
              key={c}
              cadence={c}
              current={currentCadence}
              plan={plan}
            />
          ))}
        </form>
      </section>

      {/* Multi-market scan */}
      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wider font-mono text-muted">
          Multi-market price scan
        </h2>
        <p className="mt-2 text-sm text-muted">
          Markets the daily 05:30 UTC scan polls for cross-market price /
          stock comparison. Each adds ~1 fetch per product per day.
        </p>
        <form
          action={updateMultiMarketCountries}
          className="mt-4 rounded-lg border border-default bg-elevated p-4"
        >
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
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted">
              Tip: include only markets your competitors actually sell in —
              extra markets are wasted fetches.
            </span>
            <SubmitButton
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition disabled:opacity-50"
              pendingLabel="Saving…"
            >
              Save markets
            </SubmitButton>
          </div>
        </form>
      </section>

      {/* Days-cover threshold */}
      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wider font-mono text-muted">
          Opportunities · stockout warning
        </h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Surface competitor products on the Opportunities page when their
          remaining stock divided by their daily sales velocity drops below
          this many days. Lower = earlier warning, fewer matches. Higher =
          more matches, less urgency.
        </p>
        <form
          action={updateDaysCoverThreshold}
          className="mt-4 flex items-center gap-3 rounded-lg border border-default bg-elevated p-4"
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
          <SubmitButton
            className="ml-auto rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition disabled:opacity-50"
            pendingLabel="Saving…"
          >
            Save threshold
          </SubmitButton>
        </form>
      </section>

      {/* Inventory probe */}
      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wider font-mono text-muted">
          Inventory probe
        </h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          For products where the public Shopify endpoints don't expose
          inventory, Rivlr performs a single polite cart-add probe daily
          and reads the exact stock from Shopify's response. The probe
          never completes a checkout. Read more on the{" "}
          <Link
            href="/bot"
            className="text-foreground underline-offset-4 hover:underline"
          >
            bot info page
          </Link>
          .
        </p>
        <form
          action={updateCartProbeEnabled}
          className="mt-4 rounded-lg border border-default bg-elevated p-4 flex items-center justify-between gap-4"
        >
          <div>
            <div className="text-sm font-medium">
              Probe hidden inventory daily
            </div>
            <div className="mt-1 text-xs text-muted">
              {cartProbeEnabled
                ? "On — exact quantity revealed when possible. Probe results show a 'probed' badge."
                : "Off — Rivlr only uses inventory the merchant publishes via /products.json."}
            </div>
          </div>
          <input
            type="hidden"
            name="enabled"
            value={(!cartProbeEnabled).toString()}
          />
          <button
            type="submit"
            role="switch"
            aria-checked={cartProbeEnabled}
            className={`relative h-6 w-11 flex-shrink-0 rounded-full border transition ${
              cartProbeEnabled
                ? "border-signal bg-signal"
                : "border-default bg-surface hover:border-strong"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                cartProbeEnabled ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </form>
      </section>

      {/* Notification emails */}
      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wider font-mono text-muted">
          Notification emails
        </h2>
        <p className="mt-2 text-sm text-muted">
          Where to send stock-change and price-drop alerts. Comma-separated.
          Emails actually start sending once Phase 5 (Resend) lands.
        </p>

        <form action={saveNotificationEmails} className="mt-4 space-y-3">
          <textarea
            name="emails"
            defaultValue={current}
            rows={3}
            placeholder="you@example.com, partner@example.com"
            className="block w-full rounded-md border border-default bg-elevated px-3 py-2.5 text-sm text-foreground outline-none focus:border-foreground"
          />
          <SubmitButton
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition disabled:opacity-50"
            pendingLabel="Saving…"
          >
            Save emails
          </SubmitButton>
        </form>
      </section>

      <p className="mt-10 text-xs text-muted font-mono">
        {settings
          ? `Last saved ${new Date(settings.updatedAt).toLocaleString()}`
          : "Not yet configured"}
      </p>
    </main>
  );
}

function CadenceCard({
  cadence,
  current,
  plan,
}: {
  cadence: Cadence;
  current: Cadence;
  plan: Plan;
}) {
  const allowed = isCadenceAllowed(cadence, plan);
  const isSelected = current === cadence;
  const upgradeTier =
    cadence === "every-6h" ? "Growth" : cadence === "hourly" ? "Pro" : null;

  return (
    <button
      type="submit"
      name="cadence"
      value={cadence}
      disabled={!allowed}
      className={`relative rounded-lg border p-4 text-left transition ${
        isSelected
          ? "border-signal bg-signal/[0.04]"
          : allowed
            ? "border-default bg-elevated hover:border-strong"
            : "border-default bg-elevated opacity-60 cursor-not-allowed"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{CADENCE_LABELS[cadence]}</div>
        {isSelected && (
          <span className="rounded bg-signal px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-white font-mono">
            Current
          </span>
        )}
        {!allowed && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-muted"
            aria-label="locked"
          >
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11 V7 a4 4 0 0 1 8 0 v4" />
          </svg>
        )}
      </div>
      <div className="mt-2 text-xs text-muted leading-relaxed">
        {cadence === "daily" && "Once a day. Cheapest. Good for slow-moving categories."}
        {cadence === "every-6h" && "Four times a day. Catches same-day price moves."}
        {cadence === "hourly" && "Every hour. Best for fast-moving SKUs and flash sales."}
      </div>
      {!allowed && upgradeTier && (
        <div className="mt-3 text-[11px] uppercase tracking-[0.18em] font-mono text-signal">
          Upgrade to {upgradeTier}
        </div>
      )}
    </button>
  );
}
