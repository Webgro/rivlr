/**
 * Stores list skeleton — header with stats + grid of store cards.
 */
export default function StoresLoading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 animate-pulse">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded bg-elevated" />
          <div className="h-3 w-96 rounded bg-elevated" />
          <div className="h-3 w-72 rounded bg-elevated" />
        </div>
        <div className="flex items-center gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 w-32 rounded-lg bg-elevated" />
          ))}
          <div className="h-9 w-28 rounded-md bg-elevated" />
        </div>
      </div>

      {/* Store rows */}
      <div className="mt-8 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-elevated" />
        ))}
      </div>
    </div>
  );
}
