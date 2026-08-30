"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { StepResult } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-signal px-4 py-2.5 text-sm font-medium text-black hover:bg-signal/90 disabled:opacity-60"
    >
      {pending ? "Checking the store…" : label}
    </button>
  );
}

/**
 * The store-address field, used for both the user's own store and their
 * first competitor.
 *
 * Errors render in place rather than as a redirect with a query string,
 * because a mistyped address is the single most likely thing to happen
 * here and retyping the whole thing after a page bounce is the most
 * annoying possible response to it.
 */
export function StoreForm({
  action,
  label,
  placeholder,
  initialValue = "",
}: {
  action: (
    prev: StepResult | null,
    formData: FormData,
  ) => Promise<StepResult>;
  label: string;
  placeholder: string;
  /** Carried from signup when the address was given on the way in. */
  initialValue?: string;
}) {
  // No `required` on the input: the browser's own validation bubble is
  // an unstyled tooltip that lands in the middle of a dark page looking
  // like a rendering fault, and it sits next to the styled error we
  // already show for every other rejection. One error treatment, ours.
  const [state, formAction] = useActionState(action, null);
  // Controlled, so a rejected address survives the re-render. An
  // uncontrolled input is reset by the action's response, and making
  // someone retype the address they just typed is the worst possible
  // reply to "we couldn't reach that store".
  const [value, setValue] = useState(initialValue);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="domain"
          className="block text-xs font-medium text-neutral-400"
        >
          Store address
        </label>
        <input
          id="domain"
          name="domain"
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="mt-2 block w-full rounded-md border border-neutral-700 bg-[#141414] px-3 py-2.5 text-sm text-paper placeholder-neutral-600 outline-none focus:border-signal/60 focus:ring-1 focus:ring-signal/40"
        />
      </div>

      {state && !state.ok && (
        <p className="text-sm text-signal" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton label={label} />
    </form>
  );
}
