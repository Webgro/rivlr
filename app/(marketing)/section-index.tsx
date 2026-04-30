import Link from "next/link";

/**
 * Section index marker — '01·' style label with a red dot. Used to anchor
 * each main section visually. The dot is the brand's recurring signature
 * (the rival being tracked).
 */
export function SectionIndex({
  num,
  label,
  href,
}: {
  num: string;
  label: string;
  href?: string;
}) {
  const inner = (
    <>
      <span>{num}</span>
      <span className="h-1.5 w-1.5 rounded-full bg-signal inline-block" />
      <span>{label}</span>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono hover:text-paper"
      >
        {inner}
      </Link>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
      {inner}
    </span>
  );
}

/**
 * Big stylised section divider — a row of small dots, growing from
 * neutral to signal in the middle, fading back. Replaces border-top for
 * key section breaks.
 */
export function DotDivider() {
  return (
    <div className="flex items-center justify-center gap-2 py-12" aria-hidden>
      {Array.from({ length: 9 }).map((_, i) => {
        const distance = Math.abs(i - 4);
        const size = distance === 0 ? "h-2 w-2" : "h-1 w-1";
        const fill =
          distance === 0
            ? "bg-signal"
            : distance === 1
              ? "bg-signal/50"
              : distance === 2
                ? "bg-neutral-600"
                : "bg-neutral-800";
        return <span key={i} className={`rounded-full ${size} ${fill}`} />;
      })}
    </div>
  );
}
