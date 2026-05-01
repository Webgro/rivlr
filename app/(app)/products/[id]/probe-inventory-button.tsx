"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { probeInventoryNow } from "../actions";

type Result = Awaited<ReturnType<typeof probeInventoryNow>>;

/**
 * Manual cart-probe trigger for a single product. Click → fires the
 * probe right now, shows per-variant results inline so the user can
 * see exactly what Shopify came back with. Useful when the daily cron
 * left a product showing "In stock" with no quantity — this exposes
 * whether it's an oversell-allowed variant, a regex miss, or a 4xx
 * block.
 */
export function ProbeInventoryButton({ productId }: { productId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);
  const router = useRouter();

  function run() {
    setResult(null);
    startTransition(async () => {
      const r = await probeInventoryNow(productId);
      setResult(r);
      if (r.written) router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-md border border-default bg-surface px-3 py-1.5 text-xs font-medium hover:border-strong disabled:opacity-50 transition inline-flex items-center gap-2"
      >
        {pending ? (
          <>
            <span className="rivlr-spinner" aria-hidden />
            Probing…
          </>
        ) : (
          "Probe inventory now"
        )}
      </button>

      {result && <ProbeResultPanel result={result} />}
    </div>
  );
}

function ProbeResultPanel({ result }: { result: Result }) {
  if (!result.ok) {
    return (
      <div className="mt-3 rounded-md border border-signal/40 bg-signal/5 px-4 py-3 text-sm">
        <div className="text-signal font-medium">Probe failed</div>
        <div className="mt-1 text-xs text-muted">{result.error}</div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-default bg-elevated p-4 text-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted font-mono">
            Probe result
          </div>
          <div className="mt-1 text-base font-semibold">
            {result.totalQuantity !== null
              ? `${result.totalQuantity} units (probed across ${result.variants.length} variant${result.variants.length === 1 ? "" : "s"})`
              : "Exact inventory not retrievable"}
          </div>
          {result.totalQuantity === null && (
            <div className="mt-1 text-xs text-muted leading-relaxed">
              Shopify accepted the high-quantity probe (oversell-allowed
              variant) or returned a phrasing we don&apos;t parse yet.
              Per-variant detail below.
            </div>
          )}
        </div>
        {result.written && (
          <span className="rounded bg-green-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-green-500 font-mono">
            Saved
          </span>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {result.variants.map((v) => (
          <div
            key={v.id}
            className="rounded-md border border-default bg-surface px-3 py-2 text-xs"
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <div className="font-medium truncate">{v.title}</div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <KindBadge kind={v.kind} />
                <span className="font-mono text-muted">HTTP {v.status}</span>
                {v.quantity !== null && (
                  <span className="font-mono font-semibold">
                    {v.quantity} units
                  </span>
                )}
              </div>
            </div>
            {v.message && (
              <div className="mt-1.5 text-[11px] text-muted font-mono break-words">
                <span className="opacity-60">→ </span>
                {v.message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    exact: { label: "exact", cls: "bg-green-500/15 text-green-500" },
    soldout: { label: "sold out", cls: "bg-signal/15 text-signal" },
    unbounded: {
      label: "oversell allowed",
      cls: "bg-amber-400/15 text-amber-400",
    },
    blocked: { label: "blocked", cls: "bg-signal/15 text-signal" },
    unknown: { label: "unknown", cls: "bg-elevated text-muted" },
  };
  const m = map[kind] ?? map.unknown;
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-mono ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
