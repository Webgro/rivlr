"use client";

import { useState } from "react";
import { trackStoreProduct } from "../actions";
import { dismissDiscovered } from "@/app/(app)/discover/actions";

export interface UntrackedItem {
  id: string;
  handle: string;
  title: string | null;
  imageUrl: string | null;
  url: string;
  price: string | null;
  available: boolean | null;
  /** Pre-worded sales line, or null when this shop keeps its numbers private. */
  sold: string | null;
}

type RowState = "idle" | "working" | "added" | "hidden";

/**
 * One page of a shop's products that the reader is not watching yet.
 *
 * The whole point of this list is to click "+ Track" down the page, so
 * adding a product must not move anything: the row is marked in place and
 * the reader keeps their position. Nothing here navigates or reloads.
 */
export function UntrackedList({
  items,
  currencySymbol,
  canAdd,
  remaining,
  limitMessage,
}: {
  items: UntrackedItem[];
  currencySymbol: string;
  /** False when the plan's product limit is already reached. */
  canAdd: boolean;
  /** How many more products the plan allows, or null for no limit. */
  remaining: number | null;
  /** Shown in place of the buttons when there is no room left. */
  limitMessage: string;
}) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [left, setLeft] = useState<number | null>(remaining);
  const [blocked, setBlocked] = useState(!canAdd);
  const [error, setError] = useState<string | null>(null);

  const roomLeft = blocked ? false : left === null || left > 0;

  async function add(id: string) {
    if (!roomLeft) return;
    setRows((prev) => ({ ...prev, [id]: "working" }));
    setError(null);
    try {
      const result = await trackStoreProduct(id);
      if (result.ok) {
        setRows((prev) => ({ ...prev, [id]: "added" }));
        setLeft(result.remaining);
      } else {
        setRows((prev) => ({ ...prev, [id]: "idle" }));
        setError(result.error);
        if (result.atLimit) setBlocked(true);
      }
    } catch {
      setRows((prev) => ({ ...prev, [id]: "idle" }));
      setError("That did not go through. Nothing was changed, so try again.");
    }
  }

  async function hide(id: string) {
    setRows((prev) => ({ ...prev, [id]: "hidden" }));
    const fd = new FormData();
    fd.set("id", id);
    try {
      await dismissDiscovered(fd);
    } catch {
      setRows((prev) => ({ ...prev, [id]: "idle" }));
    }
  }

  if (items.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-default px-5 py-8 text-center text-xs text-muted">
        Nothing to show here.
      </div>
    );
  }

  const visible = items.filter((i) => rows[i.id] !== "hidden");

  return (
    <div className="mt-3">
      {!roomLeft && (
        <div className="mb-3 rounded-lg border border-signal/40 bg-signal/10 px-4 py-3 text-xs text-foreground leading-relaxed">
          {limitMessage}
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-default bg-elevated px-4 py-2.5 text-xs text-signal"
        >
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-default">
        <div className="grid grid-cols-[minmax(0,2.4fr)_0.8fr_1fr_auto] gap-3 border-b border-default bg-elevated px-4 py-2.5 text-[11px] font-medium text-muted">
          <div>Product</div>
          <div className="text-right">Price</div>
          <div
            className="text-right cursor-help"
            title="At least this many sold in the last 7 days, worked out from the shop's stock count falling. Blank when the shop does not publish a count."
          >
            Selling <span className="text-muted">&#9432;</span>
          </div>
          <div className="text-right w-[132px]">Watch</div>
        </div>

        {visible.map((it) => {
          const state = rows[it.id] ?? "idle";
          return (
            <div
              key={it.id}
              className="grid grid-cols-[minmax(0,2.4fr)_0.8fr_1fr_auto] gap-3 items-center border-b border-default px-4 py-3 last:border-b-0"
            >
              <a
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 min-w-0 hover:opacity-80"
              >
                {it.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={it.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-10 w-10 rounded-md bg-elevated object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-elevated flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {it.title ?? it.handle}
                  </div>
                  <div className="truncate text-[11px] text-muted font-mono">
                    /products/{it.handle}
                  </div>
                </div>
              </a>

              <div className="text-right font-mono text-sm">
                {it.price ? (
                  <>
                    {currencySymbol}
                    {Number(it.price).toFixed(2)}
                    {it.available === false && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-[0.15em] text-signal">
                        out
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </div>

              <div className="text-right font-mono text-sm">
                {it.sold ? (
                  <span className="text-foreground">{it.sold}</span>
                ) : (
                  <span className="text-muted">-</span>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 w-[132px]">
                {state === "added" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-500">
                    Watching
                  </span>
                ) : (
                  <>
                    {roomLeft && (
                      <button
                        type="button"
                        onClick={() => add(it.id)}
                        disabled={state === "working"}
                        className="rounded-md bg-signal text-white px-2.5 py-1 text-xs font-medium hover:bg-red-600 disabled:opacity-50"
                      >
                        {state === "working" ? "Adding…" : "+ Track"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => hide(it.id)}
                      disabled={state === "working"}
                      title="Hide this one"
                      className="rounded-md border border-default bg-surface px-2.5 py-1 text-xs text-muted hover:border-strong hover:text-foreground disabled:opacity-50"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted leading-relaxed">
        Most shops keep their stock numbers private, so the selling column is
        blank for a lot of rows. That is normal. Where a number does show,
        treat it as the least that sold, not the exact figure.
        {left !== null && roomLeft ? ` Room for ${left.toLocaleString()} more on your plan.` : ""}
      </p>
    </div>
  );
}
