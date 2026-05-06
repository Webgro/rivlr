/**
 * Persistent banner shown across the entire (app) shell when an admin
 * is signed in as another user via the /admin → "Sign in as" flow.
 *
 * Visually unmissable — full-width amber strip pinned to the very top
 * of the layout, above the sidebar header, so the admin never confuses
 * an impersonation session with their own.
 *
 * Server component — read the session in the parent layout and pass
 * the relevant strings as props.
 */
export function ImpersonationBanner({
  targetEmail,
  adminEmail,
}: {
  targetEmail: string;
  adminEmail: string;
}) {
  return (
    <div className="sticky top-0 z-50 w-full border-b border-amber-500/40 bg-amber-500/10 backdrop-blur-md">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-2 text-xs font-mono">
        <div className="flex items-center gap-2 min-w-0">
          <span className="rounded bg-amber-500 text-black px-1.5 py-0.5 text-[10px] uppercase tracking-[0.2em] flex-shrink-0">
            Impersonating
          </span>
          <span className="text-foreground truncate">
            Signed in as <strong>{targetEmail}</strong>
          </span>
          <span className="text-muted hidden sm:inline">
            · admin: {adminEmail}
          </span>
        </div>
        <form
          action="/api/admin/stop-impersonating"
          method="post"
          className="flex-shrink-0"
        >
          <button
            type="submit"
            className="rounded-md bg-amber-500 text-black px-3 py-1 text-xs font-medium hover:bg-amber-400 transition"
          >
            Stop impersonating →
          </button>
        </form>
      </div>
    </div>
  );
}
