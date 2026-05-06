/**
 * Products list skeleton — heading + filter bar + table rows.
 */
export default function ProductsLoading() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10 animate-pulse">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-8 w-44 rounded bg-elevated" />
          <div className="h-3 w-64 rounded bg-elevated" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-16 rounded-md bg-elevated" />
          <div className="h-9 w-28 rounded-md bg-elevated" />
          <div className="h-9 w-32 rounded-md bg-elevated" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="mt-6 h-12 rounded-lg bg-elevated" />

      {/* Insights strip */}
      <div className="mt-6 grid gap-3 grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-elevated" />
        ))}
      </div>

      {/* Table rows */}
      <div className="mt-6 rounded-lg border border-default bg-elevated overflow-hidden">
        <div className="h-10 border-b border-default bg-surface" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-14 border-b border-default last:border-b-0 px-4 py-3 flex items-center gap-3"
          >
            <div className="h-8 w-8 rounded bg-surface flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-surface" />
              <div className="h-2 w-1/3 rounded bg-surface" />
            </div>
            <div className="h-3 w-16 rounded bg-surface flex-shrink-0" />
          </div>
        ))}
      </div>
    </section>
  );
}
