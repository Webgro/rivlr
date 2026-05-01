"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";

type Variant = "danger" | "primary";

/**
 * Lower-level controlled dialog. The parent owns the open state and
 * supplies an onConfirm callback. Use this when the action isn't a
 * server form (e.g. an existing useTransition pipeline). For
 * server-action-only flows, prefer ConfirmActionButton below.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  pending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  pending?: boolean;
}) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKey);
    cancelBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, pending]);

  if (!open) return null;

  const confirmClass =
    variant === "danger"
      ? "bg-signal text-white hover:bg-red-600"
      : "bg-foreground text-surface hover:opacity-90";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        disabled={pending}
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-[confirm-fade_0.18s_ease-out]"
      />
      <div className="relative z-10 w-full max-w-md mx-4 rounded-xl border border-default bg-surface shadow-2xl animate-[confirm-pop_0.18s_cubic-bezier(0.32,0.72,0,1)]">
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p id={descId} className="mt-2 text-sm text-muted leading-relaxed">
            {description}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-default bg-elevated rounded-b-xl">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-md border border-default bg-surface px-3 py-1.5 text-sm hover:border-strong disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${confirmClass}`}
          >
            {pending ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes confirm-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes confirm-pop {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

/**
 * Reusable button that opens a custom confirmation modal before submitting
 * a server action. Replaces window.confirm() across the app — consistent
 * styling, escape-to-cancel, focus management, no jarring browser chrome.
 *
 * Usage:
 *   <ConfirmActionButton
 *     action={deleteProduct}
 *     hidden={[{ name: "id", value: product.id }]}
 *     buttonClassName="..."
 *     buttonLabel="Delete"
 *     title="Delete this product?"
 *     description="Stops crawling and removes all observations. This cannot be undone."
 *     confirmLabel="Yes, delete"
 *     variant="danger"
 *   />
 *
 * Server action runs via a hidden <form> POST, so behaviour matches the
 * existing direct-form pattern; only the trigger differs.
 */
export function ConfirmActionButton({
  action,
  hidden = [],
  buttonClassName,
  buttonLabel,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
}: {
  action: (formData: FormData) => Promise<void> | void;
  hidden?: Array<{ name: string; value: string }>;
  buttonClassName: string;
  buttonLabel: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  // Lock body scroll + handle Escape while the dialog is open. Focus the
  // cancel button on open (safer default than confirm).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    cancelBtnRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!formRef.current) return;
    const form = formRef.current;
    startTransition(async () => {
      const fd = new FormData(form);
      await action(fd);
      setOpen(false);
    });
  }

  const confirmClass =
    variant === "danger"
      ? "bg-signal text-white hover:bg-red-600"
      : "bg-foreground text-surface hover:opacity-90";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClassName}
      >
        {buttonLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-[confirm-fade_0.18s_ease-out]"
          />

          {/* Panel */}
          <form
            ref={formRef}
            onSubmit={handleConfirm}
            className="relative z-10 w-full max-w-md mx-4 rounded-xl border border-default bg-surface shadow-2xl animate-[confirm-pop_0.18s_cubic-bezier(0.32,0.72,0,1)]"
          >
            {hidden.map((h) => (
              <input
                key={h.name}
                type="hidden"
                name={h.name}
                value={h.value}
              />
            ))}

            <div className="p-6">
              <h2
                id={titleId}
                className="text-lg font-semibold tracking-tight"
              >
                {title}
              </h2>
              <p
                id={descId}
                className="mt-2 text-sm text-muted leading-relaxed"
              >
                {description}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-default bg-elevated rounded-b-xl">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-default bg-surface px-3 py-1.5 text-sm hover:border-strong disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="submit"
                disabled={pending}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${confirmClass}`}
              >
                {pending ? "Working…" : confirmLabel}
              </button>
            </div>
          </form>

          <style>{`
            @keyframes confirm-fade {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes confirm-pop {
              from { opacity: 0; transform: scale(0.95) translateY(8px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
