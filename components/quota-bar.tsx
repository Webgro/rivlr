import Link from "next/link";
import { type ProductQuota, suggestNextPlan } from "@/lib/plan";

/**
 * Surfaced on /dashboard, /billing, and /products. Shows the user's
 * tracked-product count vs their plan limit as a horizontal bar.
 *
 * Behaviour:
 *  - Owner / unlimited: shows "Unlimited products" with a flat bar.
 *  - Under 80%: muted bar, no CTA.
 *  - 80–99%: amber bar, "Upgrade to <next plan> →" link.
 *  - 100%: signal-red bar, "You've hit your limit" + Upgrade CTA.
 *
 * Two visual densities — `compact` for the dashboard widget, default
 * for billing's prominent placement.
 */
export function QuotaBar({
  quota,
  compact,
  className,
}: {
  quota: ProductQuota;
  compact?: boolean;
  className?: string;
}) {
  const next = suggestNextPlan(quota.plan);
  const upgradeHref = next ? `/billing?upgrade=${next}` : "/billing";

  // Unlimited (owner) — degenerate case, still show the count for clarity.
  if (quota.limit === null) {
    return (
      <div className={`rounded-lg border border-default bg-elevated p-4 ${className ?? ""}`}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted/70 font-mono">
            Tracked products
          </span>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted/70 font-mono">
            Unlimited
          </span>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-xl font-semibold tracking-tight">
            {quota.current}
          </span>
          <span className="text-xs text-muted">tracked</span>
        </div>
      </div>
    );
  }

  const fillPct = Math.round(quota.fraction * 100);
  const tone = quota.full
    ? "danger"
    : quota.warning
      ? "warning"
      : "ok";

  const toneBar =
    tone === "danger"
      ? "bg-signal"
      : tone === "warning"
        ? "bg-amber-500"
        : "bg-foreground/70";

  const toneText =
    tone === "danger"
      ? "text-signal"
      : tone === "warning"
        ? "text-amber-500"
        : "text-muted";

  return (
    <div className={`rounded-lg border border-default bg-elevated p-4 ${className ?? ""}`}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted/70 font-mono">
          Tracked products
        </span>
        <span className={`text-[11px] uppercase tracking-[0.18em] font-mono ${toneText}`}>
          {fillPct}% of plan
        </span>
      </div>

      <div className={`mt-2 flex items-baseline gap-1 ${compact ? "" : ""}`}>
        <span className="text-xl font-semibold tracking-tight">
          {quota.current}
        </span>
        <span className="text-xs text-muted">/ {quota.limit}</span>
      </div>

      {/* Bar */}
      <div className="mt-3 h-1.5 rounded-full bg-surface overflow-hidden border border-default">
        <div
          className={`h-full transition-all duration-500 ${toneBar}`}
          style={{ width: `${Math.max(2, fillPct)}%` }}
        />
      </div>

      {/* Status row */}
      {(tone !== "ok" || (!compact && quota.remaining !== null)) && (
        <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-muted leading-relaxed">
            {tone === "danger"
              ? "You've hit your plan limit. Pause or remove products to track more, or upgrade."
              : tone === "warning"
                ? `Approaching your limit — ${quota.remaining} slots left.`
                : !compact
                  ? `${quota.remaining} slots remaining.`
                  : null}
          </span>
          {tone !== "ok" && next && (
            <Link
              href={upgradeHref}
              className={`text-xs font-medium underline-offset-4 hover:underline ${
                tone === "danger" ? "text-signal" : "text-amber-500"
              }`}
            >
              Upgrade to{" "}
              {next.charAt(0).toUpperCase() + next.slice(1)} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
