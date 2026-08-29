/**
 * Three-step "how it works" strip. Sits directly under the hero and
 * answers the visitor's first question: what actually happens when
 * I sign up? Deliberately plain: number, title, one sentence.
 */
export function HowItWorks() {
  const steps = [
    {
      num: "1",
      title: "Paste a URL",
      body: "Drop in any Shopify product or collection URL. Rivlr expands it, dedupes it, and starts watching.",
    },
    {
      num: "2",
      title: "We check on schedule",
      body: "Price, stock, and variants polled daily, six-hourly, or hourly depending on your plan.",
    },
    {
      num: "3",
      title: "You get told",
      body: "An email lands when a price moves or stock changes. Nothing else. Your inbox stays quiet.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-center">
        How it works
      </h2>
      <div className="mt-14 grid gap-10 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.num} className="text-center md:text-left">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-[#111111] text-base font-semibold text-signal">
              {s.num}
            </div>
            <h3 className="mt-5 text-xl font-semibold tracking-tight">
              {s.title}
            </h3>
            <p className="mt-3 text-neutral-400 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
