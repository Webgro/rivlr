/**
 * Rivlr wordmark — lowercase 'rivlr' followed by a red marker dot.
 * The dot represents the rival being tracked. Use this everywhere the
 * brand appears (sidebar, login, marketing site).
 */
export function Wordmark({
  size = "default",
  className = "",
}: {
  size?: "default" | "lg" | "xl" | "hero";
  className?: string;
}) {
  const sizeClasses =
    size === "hero"
      ? "text-5xl"
      : size === "xl"
        ? "text-3xl"
        : size === "lg"
          ? "text-2xl"
          : "text-base";
  const dotSize =
    size === "hero"
      ? "h-3.5 w-3.5"
      : size === "xl"
        ? "h-2.5 w-2.5"
        : size === "lg"
          ? "h-2 w-2"
          : "h-1.5 w-1.5";
  const gap =
    size === "hero" || size === "xl"
      ? "gap-2"
      : size === "lg"
        ? "gap-1.5"
        : "gap-1";

  return (
    <span
      className={`inline-flex items-baseline ${gap} font-semibold tracking-tight text-foreground ${sizeClasses} ${className}`}
    >
      rivlr
      <span
        className={`${dotSize} rounded-full bg-signal inline-block translate-y-[-1px]`}
        aria-hidden
      />
    </span>
  );
}
