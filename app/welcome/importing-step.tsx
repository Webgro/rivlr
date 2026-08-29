"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { OnboardingState } from "@/lib/onboarding";

const POLL_MS = 2000;

function Bar({ percent }: { percent: number }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-neutral-800"
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-signal transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
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
    <li className="flex items-baseline justify-between gap-4 py-2">
      <div className="min-w-0">
        <span className="text-sm text-paper">{label}</span>{" "}
        <span className="text-xs text-neutral-500 font-mono">{domain}</span>
        {error && <p className="mt-1 text-xs text-signal">{error}</p>}
      </div>
      <span className="shrink-0 text-xs font-mono text-neutral-400">
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
        // The server decides when setup moves on; asking it to re-render
        // avoids this component and the page disagreeing about the step.
        if (next.step !== "importing") router.refresh();
      } catch {
        // A dropped poll is not worth surfacing — the next one is 2s away.
      }
    };

    const id = setInterval(tick, POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [router]);

  const failed =
    state.mine?.status === "error" || state.competitor?.status === "error";
  const bothStores = !!state.mine?.domain && !!state.competitor?.domain;

  return (
    <div className="space-y-6">
      <Bar percent={state.percent} />

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

      <p className="text-xs text-neutral-500">
        {failed
          ? "One of the stores couldn't be read. You can carry on and add products by hand."
          : `Reading ${bothStores ? "both catalogues" : "the catalogue"}. This usually takes under a minute, and you can leave this page open.`}
      </p>
    </div>
  );
}
