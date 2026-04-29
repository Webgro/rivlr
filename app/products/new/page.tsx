import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import {
  parseShopifyUrl,
  fetchShopifyProduct,
  fetchShopifyCurrency,
  summariseProduct,
  penceToDecimal,
} from "@/lib/crawler/shopify";
import { eq, inArray } from "drizzle-orm";

type SearchParams = Promise<{ added?: string; failed?: string; dup?: string }>;

interface AddOutcome {
  url: string;
  status: "added" | "duplicate" | "invalid_url" | "fetch_failed";
  error?: string;
}

async function addProducts(formData: FormData) {
  "use server";
  const raw = String(formData.get("urls") ?? "").trim();
  if (!raw) redirect("/products/new?failed=0");

  // Split on newlines, commas, spaces; dedupe; ignore blanks.
  const urls = Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((u) => u.trim())
        .filter(Boolean),
    ),
  );

  if (urls.length === 0) redirect("/products/new?failed=0");

  // Parse + classify upfront.
  const parsed = urls.map((url) => ({ url, parsed: parseShopifyUrl(url) }));

  // Find duplicates already in DB.
  const validUrls = parsed.filter((p) => p.parsed).map((p) => p.url);
  const existing =
    validUrls.length > 0
      ? await db
          .select({ url: schema.trackedProducts.url })
          .from(schema.trackedProducts)
          .where(inArray(schema.trackedProducts.url, validUrls))
      : [];
  const existingSet = new Set(existing.map((e) => e.url));

  // Per-store concurrency cap so we don't hammer one store.
  // Group by store, run stores in parallel, sequence within a store.
  const byStore = new Map<string, typeof parsed>();
  for (const item of parsed) {
    if (!item.parsed) continue;
    if (existingSet.has(item.url)) continue;
    const arr = byStore.get(item.parsed.storeDomain) ?? [];
    arr.push(item);
    byStore.set(item.parsed.storeDomain, arr);
  }

  // Detect currency once per store.
  const currencyByStore = new Map<string, string>();
  await Promise.all(
    Array.from(byStore.keys()).map(async (store) => {
      try {
        const c = await fetchShopifyCurrency(store);
        currencyByStore.set(store, c);
      } catch {
        currencyByStore.set(store, "GBP");
      }
    }),
  );

  const outcomes: AddOutcome[] = [];

  // Mark unparseable + duplicates upfront.
  for (const { url, parsed: p } of parsed) {
    if (!p) outcomes.push({ url, status: "invalid_url" });
    else if (existingSet.has(url)) outcomes.push({ url, status: "duplicate" });
  }

  // Process per store in parallel; serially within each store.
  await Promise.all(
    Array.from(byStore.entries()).map(async ([store, items]) => {
      const currency = currencyByStore.get(store) ?? "GBP";
      for (const { url, parsed: p } of items) {
        if (!p) continue;
        try {
          const fetched = await fetchShopifyProduct(p.productJsUrl);
          const snapshot = summariseProduct(fetched);

          const [inserted] = await db
            .insert(schema.trackedProducts)
            .values({
              url,
              handle: p.handle,
              storeDomain: p.storeDomain,
              title: snapshot.title,
              imageUrl: snapshot.imageUrl,
              currency,
              lastCrawledAt: new Date(),
            })
            .onConflictDoNothing()
            .returning();

          if (inserted) {
            await db.insert(schema.priceObservations).values({
              productId: inserted.id,
              price: penceToDecimal(snapshot.price),
              currency,
            });
            await db.insert(schema.stockObservations).values({
              productId: inserted.id,
              available: snapshot.available,
              quantity: snapshot.quantity,
            });
          }

          outcomes.push({ url, status: "added" });
        } catch (err) {
          outcomes.push({
            url,
            status: "fetch_failed",
            error: err instanceof Error ? err.message : String(err),
          });
        }

        // 1s polite delay between hits to the same store.
        await new Promise((r) => setTimeout(r, 1000));
      }
    }),
  );

  const added = outcomes.filter((o) => o.status === "added").length;
  const failed = outcomes.filter(
    (o) => o.status === "invalid_url" || o.status === "fetch_failed",
  ).length;
  const dup = outcomes.filter((o) => o.status === "duplicate").length;

  revalidatePath("/dashboard");
  redirect(`/dashboard?added=${added}&failed=${failed}&dup=${dup}`);
}

export default async function NewProductPage(props: {
  searchParams: SearchParams;
}) {
  // Currently unused but kept for future error display.
  await props.searchParams;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <a
        href="/dashboard"
        className="text-xs uppercase tracking-wider text-neutral-500 font-mono hover:text-ink"
      >
        ← Back to dashboard
      </a>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink">
        Track competitor products
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        Paste one or more Shopify product URLs. One per line, or comma/space
        separated. Each URL is fetched once now to confirm it works, then
        crawled daily from tomorrow. Duplicates are skipped.
      </p>

      <form action={addProducts} className="mt-8 space-y-4">
        <div>
          <label
            htmlFor="urls"
            className="block text-xs uppercase tracking-wider text-neutral-500 font-mono"
          >
            Shopify product URLs
          </label>
          <textarea
            id="urls"
            name="urls"
            rows={10}
            placeholder={
              "https://store-a.com/products/some-handle\nhttps://store-b.com/products/another-handle"
            }
            required
            autoFocus
            className="mt-2 block w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-ink shadow-sm outline-none font-mono leading-5 focus:border-ink focus:ring-1 focus:ring-ink"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Up to ~50 URLs at a time recommended.
          </p>
        </div>

        <button
          type="submit"
          className="rounded-md bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:bg-neutral-800"
        >
          Track products
        </button>
      </form>
    </main>
  );
}
