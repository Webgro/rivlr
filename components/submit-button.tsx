"use client";

import { useFormStatus } from "react-dom";

/**
 * Generic submit button that uses React 19's useFormStatus() hook to know
 * when its parent form is mid-flight. Shows an inline spinner + dimmed
 * label while pending, and disables itself to prevent double-submits.
 *
 * Drop-in replacement for any `<button type="submit">` inside a form
 * with a server action — preserves whatever className the caller passed.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  type = "submit",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type={type}
      disabled={pending || rest.disabled}
      className={className}
      aria-busy={pending}
      {...rest}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <span className="rivlr-spinner" aria-hidden />
          <span>{pendingLabel ?? "Saving…"}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
