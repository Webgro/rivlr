"use client";

import { useState } from "react";

export function SignupForm({
  source,
  initialStoreUrl,
}: {
  source: string;
  initialStoreUrl: string;
}) {
  const [email, setEmail] = useState("");
  const [storeUrl, setStoreUrl] = useState(initialStoreUrl);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, storeUrl, source }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setDone(true);
      }
    } catch {
      setError("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
        <div className="text-3xl">✓</div>
        <div className="mt-3 text-lg font-semibold tracking-tight">
          You&apos;re on the list.
        </div>
        <p className="mt-2 text-sm text-neutral-400">
          We&apos;ll email{" "}
          <span className="font-mono text-paper">{email}</span> when launch
          access opens. No spam in the meantime.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-xs uppercase tracking-wider text-neutral-500 font-mono"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
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
          Your store / a competitor URL{" "}
          <span className="text-neutral-600 normal-case tracking-normal">
            (optional)
          </span>
        </label>
        <input
          id="storeUrl"
          type="url"
          value={storeUrl}
          onChange={(e) => setStoreUrl(e.target.value)}
          placeholder="https://yourstore.com or a competitor URL"
          className="mt-2 block w-full rounded-md border border-neutral-700 bg-[#141414] px-3 py-2.5 text-sm text-paper placeholder-neutral-500 outline-none focus:border-neutral-500 font-mono"
        />
      </div>

      {error && (
        <p className="text-sm text-signal">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-signal px-4 py-3 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
      >
        {loading ? "Joining…" : "Join the waitlist"}
      </button>
    </form>
  );
}
