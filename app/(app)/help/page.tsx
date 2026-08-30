import { ARTICLES } from "@/lib/help-articles";
import { HelpSearch } from "./help-search";

export const metadata = { title: "Help · Rivlr" };
export const dynamic = "force-static"; // help content rarely changes

/**
 * Help center index. Rendered inside the (app) layout so the sidebar
 * stays present — feels like part of the app, not a docs site
 * teleported in from elsewhere.
 *
 * The article list is rendered server-side; the search bar is a
 * client component that takes the full ARTICLES list as a prop and
 * filters it live. With ~16 articles, plain substring matching is
 * sufficient — no Fuse.js dependency.
 */
export default function HelpIndexPage() {
  // Build a flat, ordered list for the search component. Order matches
  // the unfiltered category-grouped view so results feel consistent
  // when the user clears the query.
  const categoryOrder: Array<typeof ARTICLES[number]["category"]> = [
    "Getting started",
    "Features",
    "Account & billing",
    "Troubleshooting",
  ];
  // Strip the function-typed `content` field — Article carries a thunk
  // for the article body, but client components can't receive functions
  // across the RSC boundary. The search component only needs metadata.
  const ordered = categoryOrder.flatMap((c) =>
    ARTICLES.filter((a) => a.category === c).map(
      ({ slug, title, summary, category }) => ({
        slug,
        title,
        summary,
        category,
      }),
    ),
  );

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Help</h1>
        <p className="mt-2 text-sm text-muted">
          Short guides for the things people ask about most. Can&apos;t find
          what you need? Email{" "}
          <a
            href="mailto:hello@rivlr.app"
            className="text-foreground underline-offset-4 hover:underline"
          >
            hello@rivlr.app
          </a>
          .
        </p>
      </header>

      <HelpSearch articles={ordered} categoryOrder={categoryOrder} />
    </main>
  );
}
