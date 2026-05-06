/**
 * Admin users list skeleton — heading, search box, table rows.
 */
export default function AdminUsersLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12 animate-pulse">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded bg-elevated" />
          <div className="h-3 w-40 rounded bg-elevated" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-72 rounded-md bg-elevated" />
          <div className="h-9 w-20 rounded-md bg-elevated" />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-default bg-elevated overflow-hidden">
        <div className="h-10 border-b border-default bg-surface" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="h-12 border-b border-default last:border-b-0 px-4 flex items-center gap-3"
          >
            <div className="h-3 w-1/4 rounded bg-surface" />
            <div className="h-3 w-16 rounded bg-surface" />
            <div className="h-3 w-16 rounded bg-surface" />
            <div className="h-3 w-12 rounded bg-surface" />
            <div className="h-3 w-20 rounded bg-surface ml-auto" />
          </div>
        ))}
      </div>
    </main>
  );
}
