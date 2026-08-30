"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-action-button";
import { stopWatchingRivals } from "./actions";

export interface StockTableRow {
  id: string;
  storeDomain: string;
  handle: string;
  title: string | null;
  currency: string;
  price: number | null;
  available: boolean | null;
  quantity: number | null;
  myTitle: string | null;
  myHandle: string;
  myImageUrl: string | null;
  /** Pre-worded sales figure from lib/velocity.ts, or null. */
  sold: string | null;
}

const GRID = "grid grid-cols-[28px_2.4fr_1.3fr_0.8fr_1fr_1.2fr] gap-3";

export function StockTable({
  rows,
  windowDays,
}: {
  rows: StockTableRow[];
  windowDays: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = rows.some((r) => selected.has(r.id)) && !allSelected;
  const ids = useMemo(() => Array.from(selected), [selected]);

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) for (const r of rows) next.delete(r.id);
      else for (const r of rows) next.add(r.id);
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopWatching() {
    setFeedback(null);
    startTransition(async () => {
      // try/catch so a thrown server-action error surfaces inline instead
      // of replacing the whole page with the route error boundary.
      try {
        const r = await stopWatchingRivals(ids);
        if (r.ok) {
          setFeedback(`✓ Stopped watching (${r.count ?? 0})`);
          setSelected(new Set());
        } else {
          setFeedback(`Something went wrong: ${r.error ?? "unknown"}`);
        }
      } catch (err) {
        setFeedback(
          `That did not finish. Refresh and try again with fewer rows. (${
            err instanceof Error ? err.message.slice(0, 80) : "unknown"
          })`,
        );
      }
      router.refresh();
    });
  }

  return (
    <div>
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-signal/40 bg-elevated px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            {feedback && (
              <span className="text-xs text-muted font-mono">{feedback}</span>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirmOpen(true)}
              className="rounded border border-signal/40 bg-signal/5 px-2.5 py-1 text-xs font-medium text-signal transition hover:border-signal hover:bg-signal/10 disabled:opacity-50"
            >
              Stop watching
            </button>
            <ConfirmDialog
              open={confirmOpen}
              onClose={() => setConfirmOpen(false)}
              onConfirm={() => {
                setConfirmOpen(false);
                stopWatching();
              }}
              pending={pending}
              title={`Stop watching ${selected.size} rival ${
                selected.size === 1 ? "listing" : "listings"
              }?`}
              description="Rivlr will stop checking these rival products, and their price and stock history goes with them. Your own products are not affected. This cannot be undone."
              confirmLabel="Yes, stop watching"
              variant="danger"
            />
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-muted hover:text-foreground"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-default">
        <div
          className={`${GRID} border-b border-default bg-elevated px-5 py-3 text-[11px] font-medium text-muted`}
        >
          <input
            type="checkbox"
            aria-label="Select every rival on this page"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={toggleAll}
            className="accent-signal"
          />
          <div>My product</div>
          <div>Rival shop</div>
          <div className="text-right">Their price</div>
          <div className="text-right">Their stock</div>
          <div
            className="text-right cursor-help"
            title={`At least this many sold in the last ${windowDays} days, worked out from the shop's stock count falling. Blank when the shop does not publish a count.`}
          >
            Selling <span className="text-muted">ⓘ</span>
          </div>
        </div>

        {rows.map((r) => {
          const isOut = r.available === false;
          const isSelected = selected.has(r.id);
          return (
            <div
              key={r.id}
              className={`${GRID} items-center border-b border-default px-5 py-4 last:border-b-0 transition ${
                isSelected
                  ? "bg-signal/10"
                  : isOut
                    ? "bg-signal/5 hover:bg-signal/10"
                    : "hover:bg-elevated"
              }`}
            >
              <input
                type="checkbox"
                aria-label={`Select the ${r.storeDomain} version of ${
                  r.myTitle ?? r.myHandle
                }`}
                checked={isSelected}
                onChange={() => toggleOne(r.id)}
                className="accent-signal"
              />

              <Link
                href={`/products/${r.id}`}
                className="flex items-center gap-3 min-w-0 group"
              >
                {r.myImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={r.myImageUrl}
                    alt=""
                    className="h-10 w-10 rounded-md bg-elevated object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-elevated flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium group-hover:text-signal transition">
                    {r.myTitle ?? r.myHandle}
                  </div>
                  <div className="truncate text-[11px] text-muted">
                    Their version: {r.title ?? r.handle}
                  </div>
                </div>
              </Link>

              <div className="truncate text-[11px] text-muted font-mono">
                {r.storeDomain}
              </div>

              <div className="text-right font-mono text-sm">
                {r.price !== null
                  ? `${currencySymbol(r.currency)}${r.price.toFixed(2)}`
                  : "—"}
              </div>

              <div className="text-right text-sm">
                <StockCell available={r.available} quantity={r.quantity} />
              </div>

              <div className="text-right font-mono text-sm">
                {r.sold ? (
                  <span className="text-foreground">{r.sold}</span>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StockCell({
  available,
  quantity,
}: {
  available: boolean | null;
  quantity: number | null;
}) {
  if (available === false) {
    return (
      <span className="font-mono text-sm font-medium text-signal">
        Out of stock
      </span>
    );
  }
  if (typeof quantity === "number") {
    return (
      <span className="font-mono text-sm text-foreground">
        {quantity.toLocaleString()} left
      </span>
    );
  }
  if (available === true) {
    return <span className="font-mono text-sm text-muted">In stock</span>;
  }
  return <span className="font-mono text-sm text-muted">—</span>;
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
