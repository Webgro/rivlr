"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { startSignup } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-signal px-4 py-3 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
    >
      {pending ? "Sending your link…" : "Create your account"}
    </button>
  );
}

/**
 * Signup is a single email field: there is no password to choose, so
 * creating an account and signing in are the same act. The store
 * address is optional and only used to pre-fill the first question in
 * guided setup.
 */
export function SignupForm({ initialStoreUrl }: { initialStoreUrl: string }) {
  const [state, formAction] = useActionState(startSignup, null);
  // Controlled so a rejected submission doesn't wipe what was typed.
  const [email, setEmail] = useState("");
  const [storeUrl, setStoreUrl] = useState(initialStoreUrl);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-xs uppercase tracking-wider text-neutral-500 font-mono"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@store.com"
          className="mt-2 block w-full rounded-md border border-neutral-700 bg-[#141414] px-3 py-2.5 text-sm text-paper placeholder-neutral-500 outline-none focus:border-neutral-500"
        />
      </div>
      <div>
        <label
          htmlFor="storeUrl"
          className="block text-xs uppercase tracking-wider text-neutral-500 font-mono"
        >
          Your store address{" "}
          <span className="text-neutral-600 normal-case tracking-normal">
            (optional)
          </span>
        </label>
        <input
          id="storeUrl"
          name="storeUrl"
          type="text"
          inputMode="url"
          autoCapitalize="off"
          spellCheck={false}
          value={storeUrl}
          onChange={(e) => setStoreUrl(e.target.value)}
          placeholder="yourstore.com"
          className="mt-2 block w-full rounded-md border border-neutral-700 bg-[#141414] px-3 py-2.5 text-sm text-paper placeholder-neutral-500 outline-none focus:border-neutral-500 font-mono"
        />
      </div>

      {state?.error && (
        <p className="text-sm text-signal" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton />

      <p className="text-xs text-neutral-600">
        We&apos;ll email you a link to sign in. No password to remember.
      </p>
    </form>
  );
}
