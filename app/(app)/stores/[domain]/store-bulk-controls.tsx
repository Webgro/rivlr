"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bulkTrackStoreDiscoveries,
  toggleAutoTrackNew,
} from "../actions";
import { ConfirmDialog } from "@/components/confirm-action-button";

/**
 * Header controls above the "Not tracked yet" panel on a store profile.
 *
 *   [ + Track all (N) ]   [ Auto-track new ●○ ]
 *
 * "Track all" runs the bulk action with a confirmation dialog (because
 * it can be hundreds of products and triggers a wave of crawls).
 * "Auto-track new" is a toggle that flips the per-store flag, drives the
 * daily discovery cron's behaviour from then on.
 */
export function StoreBulkControls({
  domain,
  untrackedCount,
  autoTrackEnabled,
}: {
  domain: string;
  untrackedCount: number;
  autoTrackEnabled: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function trackAll() {
    setConfirmOpen(false);
    const fd = new FormData();
    fd.set("domain", domain);
    startTransition(async () => {
      await bulkTrackStoreDiscoveries(fd);
      router.refresh();
    });
  }

  function flipAutoTrack() {
    const fd = new FormData();
    fd.set("domain", domain);
    fd.set("value", String(!autoTrackEnabled));
    startTransition(async () => {
      await toggleAutoTrackNew(fd);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {untrackedCount > 0 && (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={pending}
          className="rounded-md bg-signal text-white px-3 py-1.5 text-xs font-medium hover:bg-red-600 transition disabled:opacity-50"
        >
          + Track all ({untrackedCount})
        </button>
      )}

      <label
        className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium cursor-pointer transition select-none ${
          autoTrackEnabled
            ? "border-signal/50 bg-signal/10 text-signal"
            : "border-default bg-surface text-muted hover:border-strong hover:text-foreground"
        }`}
      >
        <span className="text-[10px] uppercase tracking-[0.18em] font-mono">
          Auto-track new
        </span>
        <button
          type="button"
          onClick={flipAutoTrack}
          disabled={pending}
          role="switch"
          aria-checked={autoTrackEnabled}
          className={`relative h-4 w-7 flex-shrink-0 rounded-full border transition ${
            autoTrackEnabled
              ? "border-signal bg-signal"
              : "border-default bg-elevated"
          }`}
        >
          <span
            className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform ${
              autoTrackEnabled ? "translate-x-[14px]" : "translate-x-[2px]"
            }`}
          />
        </button>
      </label>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={trackAll}
        pending={pending}
        title={`Track all ${untrackedCount} products from this store?`}
        description={
          <>
            Adds every untracked product on this store to your watchlist.
            They&apos;ll start crawling within a few seconds. You can
            untrack any of them later.{" "}
            <strong className="text-foreground">
              Make sure you&apos;re comfortable with your plan&apos;s
              tracked-product limit before continuing.
            </strong>
          </>
        }
        confirmLabel="Yes, track all"
        variant="primary"
      />
    </div>
  );
}
