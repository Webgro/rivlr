/**
 * Dashboard skeleton — matches the actual layout: page heading, then
 * the four-stat insights row, then the activity / opportunities
 * blocks. Renders during data fetches so users get instant feedback
 * on every navigation here.
 */
export default function DashboardLoading() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10 animate-pulse">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded bg-elevated" />
          <div className="h-3 w-72 rounded bg-elevated" />
        </div>
        <div className="h-9 w-32 rounded-md bg-elevated" />
      </div>

      {/* Insights row */}
      <div className="mt-8 grid gap-3 grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-default bg-elevated p-4">
            <div className="h-3 w-20 rounded bg-surface" />
            <div className="mt-3 h-7 w-12 rounded bg-surface" />
            <div className="mt-2 h-2 w-24 rounded bg-surface" />
          </div>
        ))}
      </div>

      {/* Top wins / opportunities placeholder rows */}
      <div className="mt-10 space-y-3">
        <div className="h-3 w-32 rounded bg-elevated" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-elevated" />
        ))}
      </div>

      <div className="mt-10 space-y-3">
        <div className="h-3 w-32 rounded bg-elevated" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-elevated" />
        ))}
      </div>
    </section>
  );
}
