"use client";

interface Sample {
  label: string;
  url: string;
}

/**
 * Sample URL buttons under the hero demo input. Click to fill the input
 * (and optionally auto-submit if `autoSubmit` is true). Removes friction
 * for visitors who don't have a competitor URL in mind right now.
 *
 * Picks three well-known live Shopify stores. If any go offline /
 * change platform we'll need to swap them out — listed in code so it's
 * a one-line edit.
 */
export function SampleUrls() {
  const samples: Sample[] = [
    {
      label: "Gymshark / vital seamless",
      url: "https://uk.gymshark.com/products/gymshark-vital-seamless-2-0-light-support-sports-bra-titanium-blue-aqz0p-fc23",
    },
    {
      label: "Allbirds / wool runner",
      url: "https://www.allbirds.com/products/mens-wool-runners",
    },
    {
      label: "Chubbies / classic short",
      url: "https://www.chubbiesshorts.com/products/the-tahitians",
    },
  ];

  function handleClick(url: string, e: React.MouseEvent) {
    e.preventDefault();
    const input = document.querySelector<HTMLInputElement>(
      'form input[type="url"]',
    );
    if (input) {
      // Use the native value setter so React picks the change up.
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(input, url);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-neutral-500 font-mono uppercase tracking-[0.15em] text-[10px]">
        Or try:
      </span>
      {samples.map((s) => (
        <button
          key={s.url}
          type="button"
          onClick={(e) => handleClick(s.url, e)}
          className="rounded border border-neutral-700 bg-[#0d0d0d] px-2 py-1 text-[11px] font-mono text-neutral-300 hover:border-signal hover:text-paper transition"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
