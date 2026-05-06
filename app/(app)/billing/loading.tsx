/**
 * Billing skeleton — header, subscription summary card (when present),
 * quota bar, plan grid. Matches the page layout closely so the
 * transition feels seamless.
 */
export default function BillingLoading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-32 rounded bg-elevated" />
        <div className="h-3 w-96 rounded bg-elevated" />
      </div>

      {/* Subscription summary block */}
      <div className="mt-6 h-32 rounded-xl bg-elevated" />

      {/* Quota bar */}
      <div className="mt-6 h-24 rounded-lg bg-elevated" />

      {/* Plan grid */}
      <div className="mt-8 space-y-3">
        <div className="h-3 w-24 rounded bg-elevated" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-72 rounded-xl bg-elevated" />
          ))}
        </div>
      </div>
    </main>
  );
}
