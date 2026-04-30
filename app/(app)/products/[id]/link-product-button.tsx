"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { linkProducts } from "../actions";

interface Candidate {
  id: string;
  title: string | null;
  store_domain: string;
  image_url: string | null;
}

export function LinkProductButton({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Server-side search: refetch on every input change (debounced) so short
  // strings like 'A5' or 'v1' work — they wouldn't survive client-side
  // token filtering.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ id: productId });
      const q = query.trim();
      if (q) params.set("q", q);
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
    }, 200); // small debounce
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, productId, query]);

  // No client-side filtering anymore — the server returns the right set.
  const filtered = candidates;

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
        className="rounded-md border border-default bg-elevated px-2.5 py-1 text-xs hover:border-strong"
      >
        + Link product
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-[2px] pt-20 px-4">
          <div className="w-full max-w-lg rounded-xl border border-default bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-default px-5 py-3">
              <h3 className="text-sm font-semibold">Link to another tracked product</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted hover:text-foreground"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <input
                type="search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full rounded-md border border-default bg-elevated px-3 py-2 text-sm outline-none focus:border-strong"
              />
              <p className="mt-2 text-xs text-muted">
                Showing products with similar names. Pick one to link them. Both
                will share a group, with prices side-by-side on each detail page.
              </p>
            </div>
            <div className="max-h-[50vh] overflow-y-auto px-2 pb-3">
              {loading ? (
                <div className="px-3 py-6 text-center text-sm text-muted">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted">
                  {query ? "No matches." : "No similar products found."}
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleLink(c.id)}
                    disabled={pending}
                    className="flex items-center gap-3 w-full rounded-md px-3 py-2 text-left hover:bg-elevated disabled:opacity-50"
                  >
                    {c.image_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={c.image_url}
                        alt=""
                        className="h-8 w-8 rounded bg-elevated object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded bg-elevated flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-sm">{c.title ?? "(untitled)"}</div>
                      <div className="truncate text-xs text-muted font-mono">{c.store_domain}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
