"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { JobProgress, OnboardingState } from "@/lib/onboarding";

const POLL_MS = 2000;
/** How long to give router.refresh() before forcing a real navigation. */
const ESCAPE_MS = 4000;

/**
 * The bar has two modes on purpose.
 *
 * Until a catalogue size comes back there is no denominator, so there
 * is nothing honest to show as a percentage — that state slides a
 * segment instead of inventing a number. Once totals are known the
 * width is real, but a real width can still sit still for many seconds
 * (a page is fetched every second, and nothing lands until a whole
 * chunk is written), so a sheen sweeps the filled portion to show the
 * work is running rather than stuck.
 */
function Bar({
  percent,
  indeterminate,
  active,
}: {
  percent: number;
  indeterminate: boolean;
  active: boolean;
}) {
  if (indeterminate) {
    return (
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-800"
        role="progressbar"
        aria-label="Reading catalogues"
      >
        <div className="rivlr-indeterminate h-full w-1/4 rounded-full bg-signal" />
      </div>
    );
  }

  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-800"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="relative h-full overflow-hidden rounded-full bg-signal transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%` }}
      >
        {active && (
          <div className="rivlr-sheen absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        )}
      </div>
    </div>
  );
}

/** Spinner shown against a job that is still reading. */
function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-600 border-t-signal align-middle"
      aria-hidden
    />
  );
}

/**
 * Honest time estimate.
 *
 * Measured at ~10ms per product on live imports — 2,353 products in
 * 22s and 4,288 in 41s, against a fetch of 250 per request with a
 * one-second polite delay between pages. So "under a minute" holds to
 * roughly six thousand products and stops being true above that, which
 * is exactly the size of catalogue most likely to be sitting on this
 * screen wondering whether anything is happening.
 *
 * Both imports run concurrently, so the wait is the slower of the two,
 * not their sum.
 */
const MS_PER_PRODUCT = 10;

function etaLabel(jobs: JobProgress[]): string {
  const running = jobs.filter((j) => j.status === "running");
  if (running.length === 0) return "Finishing up.";
  // Both imports run at once, so the wait is the larger of the two.
  if (running.some((j) => j.expected <= 0)) {
    return "Still counting. A big catalogue can take a few minutes.";
  }
  const remaining = Math.max(
    ...running.map((j) => Math.max(0, j.expected - j.imported)),
  );
  const seconds = Math.round((remaining * MS_PER_PRODUCT) / 1000);
  if (seconds < 45) return "Should be under a minute.";
  const minutes = Math.ceil(seconds / 60);
  return `About ${minutes} minute${minutes === 1 ? "" : "s"} left for a catalogue this size.`;
}

function JobLine({
  label,
  domain,
  imported,
  expected,
  status,
  error,
}: {
  label: string;
  domain: string;
  imported: number;
  expected: number;
  status: "running" | "done" | "error";
  error: string | null;
}) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-3">
      <div className="min-w-0">
        <span className="text-base text-paper">{label}</span>{" "}
        <span className="text-sm text-neutral-500 font-mono">{domain}</span>
        {error && <p className="mt-1 text-sm text-signal">{error}</p>}
      </div>
      <span className="flex shrink-0 items-center gap-2 text-sm font-mono text-neutral-400">
        {status === "running" && <Spinner />}
        {status === "error"
          ? "failed"
          : status === "done"
            ? `${imported.toLocaleString()} products`
            : expected > 0
              ? `${imported.toLocaleString()} / ${expected.toLocaleString()}`
              : "reading…"}
      </span>
    </li>
  );
}

/**
 * Live progress for the two catalogue imports.
 *
 * The imports run in `after()`, detached from the request that started
 * them, so this polls a status endpoint rather than streaming. When both
 * finish it refreshes the route, and the server re-derives the step and
 * renders the matching screen.
 */
export function ImportingStep({ initial }: { initial: OnboardingState }) {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>(initial);
  const escapeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch("/api/onboarding/status", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const next = (await res.json()) as OnboardingState;
        if (cancelled) return;
        setState(next);

        if (next.step === "importing") return;

        // The server decides when setup moves on. router.refresh() is
        // the cheap way to ask for the new step, but it cannot be
        // relied on alone: in production it left this screen up for
        // five minutes after both imports had finished in forty
        // seconds, almost certainly serving a cached RSC payload for
        // the route. So the refresh is attempted, and a hard
        // navigation is armed behind it as a guarantee. `replace`, not
        // `assign`, so Back doesn't return to a progress bar for work
        // that is already done.
        router.refresh();
        if (!escapeTimer.current) {
          escapeTimer.current = setTimeout(() => {
            window.location.replace("/welcome");
          }, ESCAPE_MS);
        }
      } catch {
        // A dropped poll is not worth surfacing — the next one is 2s away.
      }
    };

    const id = setInterval(tick, POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
      // Unmounting means the refresh worked and the next step is on
      // screen; the fallback must not then reload out from under it.
      if (escapeTimer.current) clearTimeout(escapeTimer.current);
    };
  }, [router]);

  const failed =
    state.mine?.status === "error" || state.competitor?.status === "error";
  const bothStores = !!state.mine?.domain && !!state.competitor?.domain;

  const jobs = [state.mine, state.competitor].filter(
    (j): j is JobProgress => !!j && !!j.domain,
  );
  const stillRunning = jobs.some((j) => j.status === "running");
  // No total means no honest percentage to show yet.
  const noTotalsYet = jobs.length > 0 && jobs.every((j) => j.expected <= 0);

  return (
    <div className="space-y-7">
      <Bar
        percent={state.percent}
        indeterminate={noTotalsYet}
        active={stillRunning}
      />

      <ul className="divide-y divide-neutral-900">
        {state.mine && state.mine.domain && (
          <JobLine
            label="Your store"
            domain={state.mine.domain}
            imported={state.mine.imported}
            expected={state.mine.expected}
            status={state.mine.status}
            error={state.mine.error}
          />
        )}
        {state.competitor && (
          <JobLine
            label="Competitor"
            domain={state.competitor.domain}
            imported={state.competitor.imported}
            expected={state.competitor.expected}
            status={state.competitor.status}
            error={state.competitor.error}
          />
        )}
      </ul>

      {failed ? (
        <p className="text-sm text-neutral-500">
          One of the stores couldn&apos;t be read. You can carry on and add
          products by hand.
        </p>
      ) : (
        <div className="space-y-2 text-sm text-neutral-500">
          <p>
            Reading {bothStores ? "both catalogues" : "the catalogue"}.{" "}
            {etaLabel(jobs)}
          </p>
          <p>
            You can close this tab if you like. We&apos;ll email you the moment
            it&apos;s ready.
          </p>
        </div>
      )}
    </div>
  );
}
