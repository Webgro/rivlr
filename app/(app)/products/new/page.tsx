import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import { parseShopifyUrl } from "@/lib/crawler/shopify";
import { dispatchCrawl } from "@/lib/crawler/dispatch";
import { generateLinkSuggestions } from "@/lib/crawler/link-suggestions";
import { inArray } from "drizzle-orm";
import { SubmitButton } from "./submit-button";

type SearchParams = Promise<Record<string, string>>;

/**
 * Fast-path bulk add. Validates URL format, deduplicates, bulk inserts rows
 * with `last_crawled_at = NULL`, and triggers a background crawl. Returns
 * almost instantly even for 1000+ URLs — actual price/stock fetching happens
 * in the crawler. Dashboard shows a floating progress widget while jobs run.
 */
async function addProducts(formData: FormData) {
  "use server";
  const raw = String(formData.get("urls") ?? "").trim();
  if (!raw) redirect("/dashboard");

  // Split on newlines / commas / spaces, dedupe, drop blanks.
  const urls = Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((u) => u.trim())
        .filter(Boolean),
    ),
  );

  if (urls.length === 0) redirect("/dashboard");

  // Parse + classify upfront — only valid Shopify URLs go in.
  const parsed = urls
    .map((url) => ({ url, parsed: parseShopifyUrl(url) }))
    .filter((p): p is { url: string; parsed: NonNullable<typeof p.parsed> } =>
      p.parsed !== null,
    );

  const invalidCount = urls.length - parsed.length;

  if (parsed.length === 0) {
    revalidatePath("/dashboard");
    redirect(`/dashboard?added=0&failed=${invalidCount}&dup=0`);
  }

  // Find duplicates already in DB.
  const validUrls = parsed.map((p) => p.url);
  const existing = await db
    .select({ url: schema.trackedProducts.url })
    .from(schema.trackedProducts)
    .where(inArray(schema.trackedProducts.url, validUrls));
  const existingSet = new Set(existing.map((e) => e.url));
  const toInsert = parsed.filter((p) => !existingSet.has(p.url));

  // Bulk insert in chunks of 500 (Postgres parameter limits — keeps us safe).
  const chunkSize = 500;
  let added = 0;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const slice = toInsert.slice(i, i + chunkSize);
    await db
      .insert(schema.trackedProducts)
      .values(
        slice.map(({ url, parsed: p }) => ({
          url,
          handle: p.handle,
          storeDomain: p.storeDomain,
          title: null,
          imageUrl: null,
          // Currency defaults to GBP and is re-detected on first crawl.
          // last_crawled_at = NULL signals "needs first crawl".
        })),
      )
      .onConflictDoNothing();
    added += slice.length;
  }

  // Trigger a background crawl with after() so it runs after the response
  // is sent. Direct function call — no HTTP fetch-to-self, no auth dance,
  // no Vercel deployment-protection issues. Also schedule link suggestions.
  after(async () => {
    try {
      await dispatchCrawl({});
    } catch {
      /* 5-min cron will pick up regardless */
    }
    try {
      await generateLinkSuggestions();
    } catch {
      /* non-critical */
    }
  });

  revalidatePath("/dashboard");
  redirect(
    `/dashboard?added=${added}&failed=${invalidCount}&dup=${existingSet.size}`,
  );
}

export default async function NewProductPage(props: {
  searchParams: SearchParams;
}) {
  await props.searchParams;

  return (
    <section className="mx-auto max-w-2xl px-6 py-12">
      <a
        href="/dashboard"
        className="text-xs uppercase tracking-wider text-muted font-mono hover:text-foreground"
      >
        ← Back to dashboard
      </a>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Track competitor products
      </h1>
      <p className="mt-2 text-sm text-muted">
        Paste one or more Shopify product URLs. One per line, or comma/space
        separated. URLs are added immediately as pending; price and stock are
        fetched in the background and appear on the dashboard within a few
        minutes. Duplicates and bad URLs are skipped.
      </p>

      <form action={addProducts} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="urls"
            className="block text-xs uppercase tracking-wider text-muted font-mono"
          >
            Shopify product URLs
          </label>
          <textarea
            id="urls"
            name="urls"
            rows={12}
            placeholder={
              "https://store-a.com/products/some-handle\nhttps://store-b.com/products/another-handle"
            }
            required
            autoFocus
            className="mt-2 block w-full rounded-md border border-default bg-elevated px-3 py-2.5 text-sm text-foreground shadow-sm outline-none font-mono leading-5 focus:border-strong"
          />
          <p className="mt-1 text-xs text-muted">
            No upper limit — pasted URLs go straight into the queue. Hundreds
            or thousands at a time is fine.
          </p>
        </div>

        <SubmitButton />
      </form>
    </section>
  );
}
