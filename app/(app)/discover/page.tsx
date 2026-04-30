import Link from "next/link";
import { db, schema } from "@/lib/db";
import { eq, sql, desc } from "drizzle-orm";
import { DiscoverList } from "./discover-list";
import { RunDiscoveryButton } from "./run-discovery-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type SearchParams = Promise<{
  store?: string;
  page?: string;
}>;

export default async function DiscoverPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  // Fetch all 'new' discoveries (filtered by store optionally).
  const conditions = [eq(schema.discoveredProducts.status, "new")];
  if (params.store)
    conditions.push(eq(schema.discoveredProducts.storeDomain, params.store));

  const all = await db
    .select()
    .from(schema.discoveredProducts)
    .where(
      conditions.length === 1
        ? conditions[0]
        : sql`${conditions[0]} AND ${conditions[1]}`,
    )
    .orderBy(desc(schema.discoveredProducts.firstSeen));

  const totalCount = all.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paged = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // List of stores with new products (for the filter dropdown).
  const storesRows = await db.execute<{ store_domain: string; n: number }>(sql`
    SELECT store_domain, COUNT(*)::int AS n
    FROM discovered_products
    WHERE status = 'new'
    GROUP BY store_domain
    ORDER BY n DESC, store_domain ASC
  `);
  const stores = Array.from(storesRows);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Discover
          </h1>
          <p className="mt-1 text-sm text-muted">
            New products on stores you already watch — daily catalogue scan
            at 05:00 GMT. Track the ones that matter, dismiss the rest.
          </p>
        </div>
        <RunDiscoveryButton />
      </div>

      {stores.length > 0 ? (
        <form
          method="get"
          className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-default bg-elevated px-4 py-3"
          key={params.store ?? ""}
        >
          <select
            name="store"
            defaultValue={params.store ?? ""}
            className="rounded-md border border-default bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-strong"
          >
            <option value="">All stores ({totalCount})</option>
            {stores.map((s) => (
              <option key={s.store_domain} value={s.store_domain}>
                {s.store_domain} ({s.n})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-surface"
          >
            Apply
          </button>
          {params.store && (
            <Link
              href="/discover"
              className="text-xs text-muted hover:text-foreground"
            >
              Clear
            </Link>
          )}
          <span className="ml-auto text-xs text-muted font-mono">
            {totalCount} pending
          </span>
        </form>
      ) : null}

      {paged.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-default px-8 py-16 text-center text-sm text-muted">
          {params.store
            ? `No new products discovered on ${params.store}.`
            : `No new products discovered yet. The daily scan runs at 05:00 GMT — or hit "Run scan now" to discover immediately.`}
        </div>
      ) : (
        <>
          <DiscoverList
            items={paged.map((d) => ({
              id: d.id,
              storeDomain: d.storeDomain,
              title: d.title,
              imageUrl: d.imageUrl,
              url: d.url,
              firstSeen: d.firstSeen.toISOString(),
            }))}
          />

          {totalPages > 1 && (
            <nav className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-default bg-elevated px-4 py-3">
              <Link
                href={pageHref(page - 1, params)}
                aria-disabled={page === 1}
                className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page === 1 ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
              >
                ← Previous
              </Link>
              <span className="text-xs text-muted font-mono">
                Page {page} of {totalPages}
              </span>
              <Link
                href={pageHref(page + 1, params)}
                aria-disabled={page === totalPages}
                className={`rounded-md border border-default px-3 py-1.5 text-sm transition ${page === totalPages ? "opacity-40 pointer-events-none" : "hover:border-strong"}`}
              >
                Next →
              </Link>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function pageHref(p: number, params: { store?: string }): string {
  const sp = new URLSearchParams();
  if (params.store) sp.set("store", params.store);
  if (p > 1) sp.set("page", String(p));
  const q = sp.toString();
  return `/discover${q ? "?" + q : ""}`;
}
