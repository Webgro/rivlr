"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { linkProducts } from "../actions";

interface Candidate {
  id: string;
  title: string | null;
  store_domain: string;
  image_url: string | null;
  price: string | null;
  currency: string;
  available: boolean | null;
  is_my_store: boolean;
}

interface LinkProductButtonProps {
  productId: string;
  /** When true, hide own-store products from results (use from /my-products
   *  where you're trying to link YOUR product to a competitor). */
  excludeOwnStore?: boolean;
  /** Optional override for the trigger button's label / className. Useful
   *  when this button sits inline in a row vs. as a primary CTA. */
  triggerLabel?: React.ReactNode;
  triggerClassName?: string;
  /** Optional override for the modal title — defaults to "Link to another
   *  tracked product", but /my-products uses "Link to a competitor". */
  modalTitle?: string;
  /** Reference price for the my-product, so the modal can show a
   *  Δ% column next to each candidate. */
  myPrice?: number | null;
  myCurrency?: string;
}

export function LinkProductButton({
  productId,
  excludeOwnStore = false,
  triggerLabel,
  triggerClassName,
  modalTitle = "Link to another tracked product",
  myPrice = null,
  myCurrency,
}: LinkProductButtonProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [browseAll, setBrowseAll] = useState(excludeOwnStore); // /my-products → browse all by default
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Server-side search: refetch on every input/filter change with debounce.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ id: productId });
      const q = query.trim();
      if (q) params.set("q", q);
      if (storeFilter) params.set("store", storeFilter);
      if (browseAll) params.set("browseAll", "1");
      if (excludeOwnStore) params.set("excludeOwnStore", "1");
      fetch(`/api/products/link-candidates?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((data: { candidates: Candidate[] }) =>
          setCandidates(data.candidates ?? []),
        )
        .catch(() => {
          // Ignore — likely abort from the next keystroke.
        })
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, productId, query, storeFilter, browseAll, excludeOwnStore]);

  // Distinct store list for the filter dropdown — derived client-side
  // from the current candidate set so it stays in sync with the search.
  const stores = Array.from(
    new Set(candidates.map((c) => c.store_domain)),
  ).sort();

  function handleLink(otherId: string) {
    const fd = new FormData();
    fd.set("a", productId);
    fd.set("b", otherId);
    startTransition(async () => {
      await linkProducts(fd);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "rounded-md border border-default bg-elevated px-2.5 py-1 text-xs hover:border-strong"
        }
      >
        {triggerLabel ?? "+ Link product"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-[2px] pt-16 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-default bg-surface shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-default px-5 py-3 flex-shrink-0">
              <h3 className="text-sm font-semibold">{modalTitle}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted hover:text-foreground text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Search + filters */}
            <div className="border-b border-default px-4 py-3 flex-shrink-0 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M21 21 L16.65 16.65" strokeLinecap="round" />
                  </svg>
                  <input
                    type="search"
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by title, handle, or store…"
                    className="w-full rounded-md border border-default bg-elevated pl-9 pr-3 py-2 text-sm outline-none focus:border-strong"
                  />
                </div>
                {stores.length > 1 && (
                  <select
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                    className="rounded-md border border-default bg-elevated px-2.5 py-2 text-xs font-mono outline-none focus:border-strong cursor-pointer max-w-[180px]"
                  >
                    <option value="">All stores</option>
                    {stores.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {!excludeOwnStore && (
                <label className="inline-flex items-center gap-2 text-[11px] text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={browseAll}
                    onChange={(e) => setBrowseAll(e.target.checked)}
                    className="accent-signal"
                  />
                  Browse all (instead of fuzzy auto-suggestions)
                </label>
              )}
            </div>

            {/* Candidates */}
            <div className="overflow-y-auto flex-1 min-h-[200px]">
              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-muted">
                  Loading…
                </div>
              ) : candidates.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted">
                  {query
                    ? `No matches for "${query}".`
                    : browseAll
                      ? "No competitor products tracked yet."
                      : "No similar products found. Tick 'Browse all' above to search the full catalogue."}
                </div>
              ) : (
                <div className="divide-y divide-default">
                  {candidates.map((c) => {
                    const compPrice = c.price ? Number(c.price) : null;
                    const deltaPct =
                      myPrice !== null &&
                      compPrice !== null &&
                      myPrice > 0 &&
                      myCurrency === c.currency
                        ? Math.round(((myPrice - compPrice) / myPrice) * 100)
                        : null;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleLink(c.id)}
                        disabled={pending}
                        className="grid grid-cols-[40px_minmax(0,1.6fr)_1fr_auto] items-start gap-3 w-full px-4 py-3 text-left hover:bg-elevated disabled:opacity-50 transition group"
                      >
                        {c.image_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={c.image_url}
                            alt=""
                            className="h-10 w-10 rounded bg-elevated object-cover flex-shrink-0 mt-0.5"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-elevated flex-shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium group-hover:text-signal transition leading-snug break-words">
                            {c.title ?? "(untitled)"}
                          </div>
                          <div className="text-[11px] text-muted font-mono flex items-center gap-1.5 mt-0.5 break-all">
                            {c.store_domain}
                            {c.is_my_store && (
                              <span className="text-green-500 whitespace-nowrap">
                                · yours
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-mono">
                          {compPrice !== null ? (
                            <>
                              {currencySymbol(c.currency)}
                              {compPrice.toFixed(2)}
                              {c.available === false && (
                                <span className="ml-2 text-[10px] uppercase tracking-[0.15em] text-signal">
                                  out
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </div>
                        <div className="text-right font-mono text-xs whitespace-nowrap">
                          {deltaPct === null ? (
                            <span className="text-muted">→</span>
                          ) : deltaPct > 0 ? (
                            <span className="text-green-500">−{deltaPct}%</span>
                          ) : deltaPct < 0 ? (
                            <span className="text-signal">+{Math.abs(deltaPct)}%</span>
                          ) : (
                            <span className="text-muted">±0%</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="border-t border-default px-4 py-2.5 text-[11px] text-muted leading-relaxed flex-shrink-0">
              Click any product to link.{" "}
              {myPrice !== null
                ? "Δ% shows how much cheaper (green) or more expensive (red) you are vs the competitor."
                : "Both products will share a group with prices side by side on each detail page."}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function currencySymbol(c: string) {
  switch (c) {
    case "GBP":
      return "£";
    case "USD":
      return "$";
    case "EUR":
      return "€";
    case "CAD":
      return "CA$";
    case "AUD":
      return "A$";
    default:
      return c + " ";
  }
}
