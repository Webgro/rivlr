"use client";

/**
 * Reusable on/off pill switch. Uses CSS custom properties for sizing so
 * the dot stays perfectly centered regardless of the chosen size — no
 * top-0.5 fudge factor that drifts visibly off when the parent text
 * scales.
 *
 * Two sizes:
 *   sm — 16×28 pill, 10px dot. Compact filter chips.
 *   md — 20×36 pill, 14px dot. Default — settings cards, primary
 *        toggles, the "Auto-track new" controls.
 *
 * Usage:
 *   <ToggleSwitch checked={x} onClick={...} />
 *   <ToggleSwitch checked={x} onClick={...} size="sm" />
 */
export function ToggleSwitch({
  checked,
  onClick,
  disabled,
  size = "md",
  ariaLabel,
  type = "button",
  name,
  value,
}: {
  checked: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
  /** Use type="submit" to fire a parent <form action={...}> on click. */
  type?: "button" | "submit";
  /** Optional submit form-data hooks when type="submit". */
  name?: string;
  value?: string;
}) {
  const dims =
    size === "sm"
      ? { h: 16, w: 28, dot: 10 } // sm
      : size === "lg"
        ? { h: 24, w: 44, dot: 18 } // lg — for prominent settings toggles
        : { h: 20, w: 36, dot: 14 }; // md
  const pad = (dims.h - dims.dot) / 2; // px from any edge to dot
  const onX = dims.w - dims.dot - pad;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      name={name}
      value={value}
      style={{ height: dims.h, width: dims.w }}
      className={`relative flex-shrink-0 rounded-full border transition disabled:opacity-50 ${
        checked
          ? "border-signal bg-signal"
          : "border-default bg-elevated hover:border-strong"
      }`}
    >
      <span
        style={{
          height: dims.dot,
          width: dims.dot,
          top: pad,
          transform: checked
            ? `translateX(${onX - pad}px)`
            : "translateX(0)",
          left: pad,
        }}
        className="absolute rounded-full bg-white transition-transform"
        aria-hidden
      />
    </button>
  );
}
