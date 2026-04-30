import { SectionIndex } from "./section-index";

/**
 * Three-step "how it works" section. Sits between hero and capabilities,
 * answering the visitor's first instinct: "how does this actually work?"
 * Numbered, monospaced, terse — matches the surveillance/intel aesthetic
 * of the rest of the page.
 */
export function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Paste a URL",
      body: "One Shopify product URL, or a whole collection, or a CSV. Rivlr expands and dedupes everything in the background.",
      hint: "Setup time: 1 minute.",
    },
    {
      num: "02",
      title: "We watch every hour",
      body: "Price, stock, variants, sales velocity, all polled on cadence. New launches detected on a daily catalogue scan.",
      hint: "Forever history kept.",
    },
    {
      num: "03",
      title: "Mail when it lands",
      body: "Per-product opt-in alerts. Deduped within 24h. Quiet inbox, only the moves you care about.",
      hint: "No notification fatigue.",
    },
  ];

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 py-20">
      <SectionIndex num="·" label="How it works" />
      <h2 className="mt-5 max-w-3xl text-4xl md:text-6xl font-semibold tracking-tight leading-[0.98]">
        Three steps.{" "}
        <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
          That&apos;s it.
        </span>
      </h2>

      <div className="mt-14 grid gap-6 md:grid-cols-3 relative">
        {/* Connector line on desktop */}
        <div className="hidden md:block absolute top-[44px] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent pointer-events-none" />

        {steps.map((s) => (
          <div
            key={s.num}
            className="relative rounded-xl border border-neutral-800 bg-[#0d0d0d] p-6 hover:border-neutral-700 transition group"
          >
            {/* Step number badge */}
            <div className="flex items-center gap-3">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-signal/40 bg-signal/10 text-[11px] font-mono text-signal font-semibold">
                {s.num}
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-mono">
                Step
              </span>
            </div>

            <h3 className="mt-5 text-2xl font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{s.body}</p>
            <div className="mt-5 pt-4 border-t border-neutral-800/60 text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-mono flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-signal/70" />
              {s.hint}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
