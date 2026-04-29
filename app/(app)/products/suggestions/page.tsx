import Link from "next/link";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { acceptSuggestion, dismissSuggestion } from "./actions";
import { RegenerateButton } from "./regenerate-button";

export const dynamic = "force-dynamic";

type SuggestionRow = {
  id: string;
  score: string;
  a_id: string;
  a_title: string | null;
  a_handle: string;
  a_store: string;
  a_image: string | null;
  b_id: string;
  b_title: string | null;
  b_handle: string;
  b_store: string;
  b_image: string | null;
  [key: string]: unknown;
};

async function getSuggestions() {
  return Array.from(
    await db.execute<SuggestionRow>(sql`
      SELECT
        s.id, s.score::text AS score,
        a.id AS a_id, a.title AS a_title, a.handle AS a_handle,
        a.store_domain AS a_store, a.image_url AS a_image,
        b.id AS b_id, b.title AS b_title, b.handle AS b_handle,
        b.store_domain AS b_store, b.image_url AS b_image
      FROM link_suggestions s
      JOIN tracked_products a ON a.id = s.product_a_id
      JOIN tracked_products b ON b.id = s.product_b_id
      WHERE s.status = 'pending'
      ORDER BY s.score DESC
      LIMIT 100
    `),
  );
}

export default async function SuggestionsPage() {
  const suggestions = await getSuggestions();

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Suggested links
          </h1>
          <p className="mt-1 text-sm text-muted">
            Pairs of tracked products that look like the same item across
            different stores. Accept to put them in a shared group; dismiss
            to suppress.
          </p>
        </div>
        <RegenerateButton />
      </div>

      <div className="mt-8">
        {suggestions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-default px-8 py-12 text-center text-sm text-muted">
            No pending suggestions. Add more products and we'll look for matches.
          </div>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-default bg-elevated p-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted font-mono">
                    Match score: {(Number(s.score) * 100).toFixed(0)}%
                  </div>
                  <div className="flex gap-2">
                    <form action={acceptSuggestion}>
                      <input type="hidden" name="id" value={s.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-foreground px-3 py-1 text-xs font-medium text-surface"
                      >
                        Link
                      </button>
                    </form>
                    <form action={dismissSuggestion}>
                      <input type="hidden" name="id" value={s.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-default px-3 py-1 text-xs text-muted hover:text-foreground hover:border-strong"
                      >
                        Dismiss
                      </button>
                    </form>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <ProductMini
                    id={s.a_id}
                    title={s.a_title ?? s.a_handle}
                    store={s.a_store}
                    image={s.a_image}
                  />
                  <ProductMini
                    id={s.b_id}
                    title={s.b_title ?? s.b_handle}
                    store={s.b_store}
                    image={s.b_image}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ProductMini({
  id,
  title,
  store,
  image,
}: {
  id: string;
  title: string;
  store: string;
  image: string | null;
}) {
  return (
    <Link
      href={`/products/${id}`}
      className="flex items-center gap-3 rounded-md p-2 hover:bg-surface min-w-0"
    >
      {image ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={image}
          alt=""
          className="h-10 w-10 rounded bg-surface object-cover flex-shrink-0"
        />
      ) : (
        <div className="h-10 w-10 rounded bg-surface flex-shrink-0" />
      )}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-muted font-mono">{store}</div>
      </div>
    </Link>
  );
}
