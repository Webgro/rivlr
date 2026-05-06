/**
 * Default loading skeleton for every (app) route that doesn't ship its
 * own loading.tsx. Renders inside the sidebar shell while server-side
 * data fetches resolve, so the user gets instant feedback on every
 * navigation rather than staring at the previous page frozen.
 *
 * Per-route loading.tsx files override this with layout-specific
 * skeletons (see /products/[id]/loading.tsx).
 */
export default function AppLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="animate-pulse">
        {/* Page heading */}
        <div className="space-y-3">
          <div className="h-8 w-48 rounded bg-elevated" />
          <div className="h-3 w-72 rounded bg-elevated" />
        </div>

        {/* Generic content blocks — works for tables, grids, and stat
            rows alike. Three rectangles + a wider one ≈ "page loading"
            without committing to a layout shape. */}
        <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-elevated" />
          ))}
        </div>

        <div className="mt-8 h-16 rounded-lg bg-elevated" />
        <div className="mt-3 h-64 rounded-lg bg-elevated" />
      </div>
    </main>
  );
}
