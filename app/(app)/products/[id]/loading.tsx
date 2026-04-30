/**
 * Skeleton for direct navigation to /products/[id] (full page, no slide-over).
 * Renders while the data fetches resolve.
 */
export default function ProductLoading() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10 animate-pulse">
      <div className="flex items-start gap-6">
        <div className="h-24 w-24 rounded-lg bg-elevated flex-shrink-0" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-32 rounded bg-elevated" />
          <div className="h-7 w-2/3 rounded bg-elevated" />
          <div className="h-3 w-44 rounded bg-elevated" />
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-8 w-24 rounded-md bg-elevated" />
          <div className="h-8 w-24 rounded-md bg-elevated" />
        </div>
      </div>
      <div className="mt-6 h-24 rounded-lg bg-elevated" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-elevated" />
        ))}
      </div>
      <div className="mt-8 h-64 rounded-lg bg-elevated" />
      <div className="mt-8 h-64 rounded-lg bg-elevated" />
    </section>
  );
}
