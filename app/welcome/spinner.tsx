/**
 * The one spinner used across guided setup.
 *
 * Every step here has at least one wait that outlasts a click: reading
 * a catalogue, comparing two of them, writing the tracked products.
 * Each of those needs to look busy, and they should all look busy the
 * same way.
 */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={
        "inline-block shrink-0 animate-spin rounded-full border-2 align-middle " +
        (className || "h-3 w-3 border-neutral-600 border-t-signal")
      }
      aria-hidden
    />
  );
}
