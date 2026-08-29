import Link from "next/link";
import type { DashboardInsights } from "@/lib/dashboard-insights";

export function InsightsRow({ insights }: { insights: DashboardInsights }) {
  const anyActivity =
    insights.priceRaisedCount24h +
      insights.priceDroppedCount24h +
      insights.newStockOuts24h +
      insights.newRestocks24h +
      insights.pendingSuggestions >
    0;

  if (!anyActivity) return null;

  return (
    <div className="mt-6 grid gap-3 grid-cols-2 md:grid-cols-4">
      <InsightCard
        eyebrow="Price changes (24h)"
        primary={`${insights.priceRaisedCount24h + insights.priceDroppedCount24h}`}
        secondary={
          <>
            <span className="text-signal">↑ {insights.priceRaisedCount24h}</span>{" "}
            <span className="text-green-500">↓ {insights.priceDroppedCount24h}</span>
          </>
        }
      />
      <InsightCard
        eyebrow="Stock changes (24h)"
        primary={`${insights.newStockOuts24h + insights.newRestocks24h}`}
        secondary={
          <>
            <span className="text-signal">⊘ {insights.newStockOuts24h} out</span>{" "}
            <span className="text-green-500">↑ {insights.newRestocks24h} restocked</span>
          </>
        }
      />
      <InsightCard
        eyebrow="Biggest drop (24h)"
        primary={
          insights.biggestDrop
            ? `${currencySymbol(insights.biggestDrop.currency)}${Math.abs(
                insights.biggestDrop.delta,
              ).toFixed(2)}`
            : "—"
        }
        secondary={
          insights.biggestDrop ? (
            <Link
              href={`/products/${insights.biggestDrop.productId}`}
              className="block truncate hover:underline"
            >
              {insights.biggestDrop.title} ({insights.biggestDrop.pct.toFixed(1)}%)
            </Link>
          ) : (
            "no drops yet"
          )
        }
      />
      <InsightCard
        eyebrow="Suggested matches"
        primary={insights.pendingSuggestions.toString()}
        secondary={
          insights.pendingSuggestions > 0 ? (
            <Link
              href="/products/suggestions"
              className="block hover:underline text-foreground"
            >
              Review matches
            </Link>
          ) : (
            "none pending"
          )
        }
      />
    </div>
  );
}

function InsightCard({
  eyebrow,
  primary,
  secondary,
}: {
  eyebrow: string;
  primary: string;
  secondary: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-default bg-elevated p-4">
      <div className="text-[11px] font-medium text-muted">
        {eyebrow}
      </div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">
        {primary}
      </div>
      <div className="mt-1 text-xs text-muted font-mono truncate">
        {secondary}
      </div>
    </div>
  );
}

function currencySymbol(c: string) {
  switch (c) {
    case "GBP":
      return "£";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    default:
      return c + " ";
  }
}
