import type { ReactNode } from "react";
import { finishSetup } from "./actions";

const STEPS = [
  { key: "store", label: "Your store" },
  { key: "competitor", label: "Competitor" },
  { key: "importing", label: "Reading prices" },
  { key: "link", label: "Match products" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

/**
 * Chrome shared by every setup step: the brand, the step indicator, and
 * the exit.
 *
 * The exit is on every step on purpose. Setup is a convenience, not a
 * toll gate, and a user who can't get past it has no way to reach the
 * thing they signed up for.
 */
export function SetupShell({
  current,
  title,
  subtitle,
  children,
  exitLabel = "Skip setup",
}: {
  current: StepKey;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  exitLabel?: string;
}) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);

  return (
    <main
      className="min-h-screen bg-[#0a0a0a] text-paper flex flex-col items-center px-6 py-12 sm:py-20"
      data-theme="dark"
    >
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-baseline gap-1.5 text-xl font-semibold tracking-tight text-paper">
            rivlr
            <span
              className="h-2 w-2 rounded-full bg-signal inline-block translate-y-[-1px]"
              aria-hidden
            />
          </span>
          <form action={finishSetup}>
            <button
              type="submit"
              className="text-xs text-neutral-500 hover:text-neutral-300 underline underline-offset-4"
            >
              {exitLabel}
            </button>
          </form>
        </div>

        <ol className="mt-10 flex items-center gap-2" aria-label="Setup progress">
          {STEPS.map((step, i) => {
            const state =
              i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
            return (
              <li key={step.key} className="flex-1">
                <div
                  className={
                    "h-1 rounded-full " +
                    (state === "todo" ? "bg-neutral-800" : "bg-signal")
                  }
                  aria-hidden
                />
                <span
                  className={
                    "mt-2 block text-[11px] " +
                    (state === "current"
                      ? "text-paper"
                      : state === "done"
                        ? "text-neutral-500"
                        : "text-neutral-600")
                  }
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>

        <h1 className="mt-10 text-3xl font-semibold tracking-tight text-paper">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-2 text-sm text-neutral-400">{subtitle}</div>
        )}

        <div className="mt-8">{children}</div>

        <p className="mt-16 text-xs text-neutral-600 font-mono">
          rivlr · a Webgro product
        </p>
      </div>
    </main>
  );
}
