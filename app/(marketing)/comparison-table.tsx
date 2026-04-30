import { SectionIndex } from "./section-index";

/**
 * Comparison table: Rivlr vs Prisync vs manual spreadsheet. Positions
 * Rivlr against the obvious incumbent (Prisync at $99/mo) and the
 * default ("I'll just do it in a spreadsheet"). Honest where the
 * incumbents are stronger, blunt where they're not.
 *
 * Renders as cards on mobile (no horizontal scroll), grid on desktop.
 */
export function ComparisonTable() {
  type Cell =
    | { kind: "yes"; note?: string }
    | { kind: "no"; note?: string }
    | { kind: "partial"; note: string }
    | { kind: "text"; value: string };

  interface Row {
    feature: string;
    rivlr: Cell;
    prisync: Cell;
    spreadsheet: Cell;
  }

  const rows: Row[] = [
    {
      feature: "Starts at",
      rivlr: { kind: "text", value: "£0" },
      prisync: { kind: "text", value: "$99/mo" },
      spreadsheet: { kind: "text", value: "Your weekend" },
    },
    {
      feature: "Setup time",
      rivlr: { kind: "text", value: "1 minute" },
      prisync: { kind: "text", value: "Sales call" },
      spreadsheet: { kind: "text", value: "Hours" },
    },
    {
      feature: "Hourly tracking",
      rivlr: { kind: "yes" },
      prisync: { kind: "partial", note: "Higher tiers" },
      spreadsheet: { kind: "no" },
    },
    {
      feature: "Stock & variant counts",
      rivlr: { kind: "yes" },
      prisync: { kind: "no" },
      spreadsheet: { kind: "no" },
    },
    {
      feature: "Sales velocity",
      rivlr: { kind: "yes" },
      prisync: { kind: "no" },
      spreadsheet: { kind: "no" },
    },
    {
      feature: "New product discovery",
      rivlr: { kind: "yes" },
      prisync: { kind: "no" },
      spreadsheet: { kind: "no" },
    },
    {
      feature: "Email alerts on change",
      rivlr: { kind: "yes" },
      prisync: { kind: "yes" },
      spreadsheet: { kind: "no" },
    },
    {
      feature: "Forever price history",
      rivlr: { kind: "yes" },
      prisync: { kind: "partial", note: "Plan-limited" },
      spreadsheet: { kind: "partial", note: "If you remember" },
    },
    {
      feature: "Built for Shopify",
      rivlr: { kind: "yes" },
      prisync: { kind: "partial", note: "Generic scraper" },
      spreadsheet: { kind: "no" },
    },
  ];

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
      <SectionIndex num="·" label="vs the alternatives" />
      <h2 className="mt-5 max-w-3xl text-4xl md:text-6xl font-semibold tracking-tight leading-[0.98]">
        Why not just{" "}
        <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
          a spreadsheet
        </span>
        ?
      </h2>
      <p className="mt-5 max-w-2xl text-neutral-400 leading-relaxed">
        Three honest comparisons. We&apos;re cheaper than incumbents and
        infinitely better than tabs in Excel. Prisync is fine if you have
        a procurement department. We&apos;re built for the operator who
        just wants the data.
      </p>

      {/* Desktop: full table */}
      <div className="mt-14 hidden md:block rounded-xl border border-neutral-800 bg-[#0d0d0d] overflow-hidden">
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] border-b border-neutral-800 bg-[#141414]">
          <div className="px-5 py-4 text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
            Capability
          </div>
          <div className="px-5 py-4 text-center bg-signal/[0.04] border-l border-r border-signal/20 relative">
            <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal px-2.5 py-0.5 text-[9px] uppercase tracking-[0.2em] text-white font-mono">
              Rivlr
            </span>
            <div className="text-sm font-semibold text-paper">Rivlr</div>
            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">From £0</div>
          </div>
          <div className="px-5 py-4 text-center border-r border-neutral-800">
            <div className="text-sm font-semibold text-neutral-300">Prisync</div>
            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">From $99/mo</div>
          </div>
          <div className="px-5 py-4 text-center">
            <div className="text-sm font-semibold text-neutral-300">Spreadsheet</div>
            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">Free + tears</div>
          </div>
        </div>

        {rows.map((r, i) => (
          <div
            key={r.feature}
            className={`grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center ${
              i !== rows.length - 1 ? "border-b border-neutral-800/70" : ""
            } hover:bg-[#101010] transition`}
          >
            <div className="px-5 py-4 text-sm text-paper font-medium">
              {r.feature}
            </div>
            <CompareCell cell={r.rivlr} highlighted />
            <CompareCell cell={r.prisync} />
            <CompareCell cell={r.spreadsheet} />
          </div>
        ))}
      </div>

      {/* Mobile: stacked cards */}
      <div className="mt-12 md:hidden space-y-4">
        {([
          { name: "Rivlr", subtitle: "From £0", highlight: true, get: (r: Row) => r.rivlr },
          { name: "Prisync", subtitle: "From $99/mo", highlight: false, get: (r: Row) => r.prisync },
          { name: "Spreadsheet", subtitle: "Free + tears", highlight: false, get: (r: Row) => r.spreadsheet },
        ] satisfies Array<{ name: string; subtitle: string; highlight: boolean; get: (r: Row) => Cell }>).map((col) => (
          <div
            key={col.name}
            className={`rounded-xl border p-5 ${
              col.highlight
                ? "border-signal/40 bg-signal/[0.03]"
                : "border-neutral-800 bg-[#0d0d0d]"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <div className="text-lg font-semibold text-paper">{col.name}</div>
              <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-[0.18em]">
                {col.subtitle}
              </div>
            </div>
            <div className="mt-4 space-y-2.5">
              {rows.map((r) => (
                <div
                  key={r.feature}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-neutral-400">{r.feature}</span>
                  <CompareCellInline cell={col.get(r)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-xs text-neutral-500 font-mono">
        · Comparison based on publicly listed features as of April 2026.
        Prisync is a registered trademark of its respective owner.
      </div>
    </section>
  );
}

function CompareCell({
  cell,
  highlighted,
}: {
  cell:
    | { kind: "yes"; note?: string }
    | { kind: "no"; note?: string }
    | { kind: "partial"; note: string }
    | { kind: "text"; value: string };
  highlighted?: boolean;
}) {
  return (
    <div
      className={`px-5 py-4 text-center ${
        highlighted ? "bg-signal/[0.04] border-l border-r border-signal/20" : ""
      } ${!highlighted ? "border-r border-neutral-800/70 last:border-r-0" : ""}`}
    >
      <CompareCellInline cell={cell} />
    </div>
  );
}

function CompareCellInline({
  cell,
}: {
  cell:
    | { kind: "yes"; note?: string }
    | { kind: "no"; note?: string }
    | { kind: "partial"; note: string }
    | { kind: "text"; value: string };
}) {
  if (cell.kind === "yes") {
    return (
      <div className="inline-flex flex-col items-center gap-0.5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
          <path d="M5 12 L10 17 L19 7" />
        </svg>
        {cell.note && (
          <span className="text-[10px] text-neutral-500 font-mono">{cell.note}</span>
        )}
      </div>
    );
  }
  if (cell.kind === "no") {
    return (
      <div className="inline-flex flex-col items-center gap-0.5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-700">
          <path d="M6 6 L18 18 M18 6 L6 18" />
        </svg>
        {cell.note && (
          <span className="text-[10px] text-neutral-500 font-mono">{cell.note}</span>
        )}
      </div>
    );
  }
  if (cell.kind === "partial") {
    return (
      <div className="inline-flex flex-col items-center gap-0.5">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
          <path d="M5 12 L19 12" />
        </svg>
        <span className="text-[10px] text-neutral-500 font-mono">{cell.note}</span>
      </div>
    );
  }
  return (
    <span className="text-sm font-mono text-paper">{cell.value}</span>
  );
}
