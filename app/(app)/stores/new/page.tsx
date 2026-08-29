import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { addStore } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export const metadata = { title: "Add store · Rivlr" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  error?: string;
  domain?: string;
}>;

/**
 * "Add store" form — lets the user surface a store on /stores without
 * having to track a product first. Two main reasons to do this:
 *   1. Adding your OWN store so you can mark it as "my store" and
 *      auto-import your catalogue (free, doesn't count toward your
 *      plan).
 *   2. Pre-loading a competitor store you want to explore via the
 *      store-scan flow before tracking individual products.
 */
export default async function NewStorePage(props: {
  searchParams: SearchParams;
}) {
  await requireUser();
  const params = await props.searchParams;
  const error = errorCopy(params.error, params.domain);

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <Link
        href="/stores"
        className="text-xs font-medium text-muted hover:text-foreground"
      >
        ← Back to stores
      </Link>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Add a store</h1>
      <p className="mt-2 text-sm text-muted leading-relaxed">
        Add a Shopify store to your list without tracking any products yet.
        Handy for adding your own store before importing your catalogue,
        or for saving a competitor store to explore later.
      </p>

      {error && (
        <div className="mt-6 rounded-md border border-signal/40 bg-signal/[0.04] px-4 py-3 text-sm">
          <div className="text-signal font-medium">{error.title}</div>
          <div className="mt-1 text-xs text-muted">{error.body}</div>
        </div>
      )}

      <form action={addStore} className="mt-8 space-y-6">
        <div>
          <label
            htmlFor="domain"
            className="block text-xs font-medium text-muted"
          >
            Store URL
          </label>
          <input
            id="domain"
            name="domain"
            type="text"
            required
            autoFocus
            defaultValue={params.domain ?? ""}
            placeholder="gymshark.com, or https://yourstore.myshopify.com"
            className="mt-2 block w-full rounded-md border border-default bg-elevated px-3 py-2.5 text-sm text-foreground placeholder-muted shadow-sm outline-none font-mono leading-5 focus:border-strong"
          />
          <p className="mt-1 text-xs text-muted">
            Any form works: the web address with or without https. We do a
            quick check that it&apos;s a real Shopify store before adding.
          </p>
        </div>

        <div className="rounded-lg border border-default bg-elevated p-4">
          <label
            htmlFor="is-my-store"
            className="flex items-start gap-3 cursor-pointer"
          >
            <input
              id="is-my-store"
              name="is-my-store"
              type="checkbox"
              value="true"
              className="mt-1 accent-signal flex-shrink-0"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                This is my store
              </span>
              <span className="mt-1 block text-xs text-muted leading-relaxed">
                Marks the store as yours and imports your full catalogue
                into <strong>My products</strong> (free, doesn&apos;t count
                toward your plan). It also unlocks bestseller insights and
                the Opportunities view. Only one store can be your own at a
                time.
              </span>
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3 justify-end">
          <Link
            href="/stores"
            className="text-sm text-muted hover:text-foreground transition"
          >
            Cancel
          </Link>
          <SubmitButton
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition disabled:opacity-50"
            pendingLabel="Adding…"
          >
            Add store
          </SubmitButton>
        </div>
      </form>
    </main>
  );
}

function errorCopy(
  code: string | undefined,
  domain: string | undefined,
): { title: string; body: string } | null {
  if (!code) return null;
  switch (code) {
    case "invalid-url":
      return {
        title: "That doesn't look like a web address.",
        body: "Try something like gymshark.com or https://yourstore.myshopify.com.",
      };
    case "unreachable":
      return {
        title: `Couldn't reach ${domain ?? "that store"}.`,
        body: "Check the address and try again. The store may be down, limited to certain countries, or blocking checks.",
      };
    case "not-shopify":
      return {
        title: `${domain ?? "That URL"} doesn't look like a Shopify store.`,
        body: "Rivlr can only read stores that share their catalogue publicly, which most Shopify stores do. If yours doesn't, email hello@rivlr.app and we'll help.",
      };
    default:
      return null;
  }
}
