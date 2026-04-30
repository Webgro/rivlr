/**
 * Scrolling intel ticker — fake real-time competitor moves, marquee-style.
 * Pure CSS animation. The data is invented but flavoured to look plausible
 * for the kinds of products Rivlr customers track.
 */

const ENTRIES = [
  { kind: "drop", store: "verdantcloth.myshopify.com", title: "Linen Overshirt — Sand", from: "£94", to: "£89" },
  { kind: "out", store: "runfast.myshopify.com", title: "Aero Trainer 02 — Bone", note: "out of stock" },
  { kind: "drop", store: "kettlerituals.myshopify.com", title: "Matcha Daily Whisk — Bamboo", from: "£21.50", to: "£18.50" },
  { kind: "rise", store: "northhide.myshopify.com", title: "Roll-Top Backpack — Coal", from: "£139", to: "£155" },
  { kind: "in", store: "petworld.co.uk", title: "Premium Dog Food 5kg", note: "back in stock" },
  { kind: "drop", store: "nocturnegoods.myshopify.com", title: "Sleep Mask — Charcoal Silk", from: "£45", to: "£42" },
  { kind: "out", store: "subliblanks.com", title: "PU Leather Sticky Note Box", note: "out of stock" },
  { kind: "rise", store: "kennelclub.shop", title: "Premium Dog Food 12kg", from: "£62", to: "£68" },
];

export function IntelTicker() {
  // Repeat the list so the marquee loops seamlessly without a visible cut.
  const repeated = [...ENTRIES, ...ENTRIES];

  return (
    <div className="relative border-y border-neutral-800/80 bg-[#0a0a0a]/60 backdrop-blur overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
      <div className="ticker-track flex items-center gap-8 py-3 whitespace-nowrap">
        {repeated.map((e, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2.5 text-xs font-mono text-neutral-400"
          >
            <Badge kind={e.kind as never} />
            <span className="text-neutral-500">{e.store}</span>
            <span className="text-neutral-600">›</span>
            <span className="text-paper">{e.title}</span>
            {e.from && e.to ? (
              <>
                <span className="text-neutral-600">·</span>
                <span className="line-through text-neutral-600">{e.from}</span>
                <span
                  className={
                    e.kind === "drop" ? "text-green-500" : "text-signal"
                  }
                >
                  {e.to}
                </span>
              </>
            ) : (
              <>
                <span className="text-neutral-600">·</span>
                <span
                  className={
                    e.kind === "in" ? "text-green-500" : "text-signal"
                  }
                >
                  {e.note}
                </span>
              </>
            )}
          </span>
        ))}
      </div>
      <style>{`
        .ticker-track {
          animation: ticker-scroll 60s linear infinite;
          width: max-content;
        }
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ticker-track {
            animation-duration: 240s;
          }
        }
      `}</style>
    </div>
  );
}

function Badge({ kind }: { kind: "drop" | "rise" | "in" | "out" }) {
  const config = {
    drop: { label: "PRICE ↓", color: "text-green-500", border: "border-green-500/30" },
    rise: { label: "PRICE ↑", color: "text-signal", border: "border-signal/30" },
    in: { label: "RESTOCK", color: "text-green-500", border: "border-green-500/30" },
    out: { label: "OOS", color: "text-signal", border: "border-signal/30" },
  }[kind];
  return (
    <span
      className={`px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] border ${config.color} ${config.border} bg-[#0a0a0a]`}
    >
      {config.label}
    </span>
  );
}
