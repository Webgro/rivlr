/**
 * Shown while /welcome is being rendered on the server.
 *
 * The link step is the slow one: it compares the two catalogues against
 * each other before it can show anything, which takes a couple of
 * seconds on stores of a few thousand products. Without this, the
 * navigation into it looks like the browser has stalled, which is
 * exactly the complaint the progress screen was built to avoid.
 */
export default function WelcomeLoading() {
  return (
    <main
      className="min-h-screen bg-[#0a0a0a] text-paper flex flex-col items-center justify-center px-6 py-12 sm:py-16"
      data-theme="dark"
    >
      <div className="w-full max-w-3xl">
        <span className="inline-flex items-baseline gap-2 text-2xl font-semibold tracking-tight text-paper">
          rivlr
          <span
            className="h-2.5 w-2.5 rounded-full bg-signal inline-block translate-y-[-1px]"
            aria-hidden
          />
        </span>

        <div className="mt-12 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
          <div className="rivlr-indeterminate h-full w-1/4 rounded-full bg-signal" />
        </div>

        <p className="mt-10 flex items-center gap-2.5 text-base text-neutral-400">
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-700 border-t-signal"
            aria-hidden
          />
          One moment.
        </p>
      </div>
    </main>
  );
}
