import Link from "next/link";
import { notFound } from "next/navigation";
import { findArticle, ARTICLES } from "@/lib/help-articles";
import { HELP_CONTENT } from "@/lib/help-content";

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata(props: { params: Params }) {
  const { slug } = await props.params;
  const article = findArticle(slug);
  if (!article) return {};
  return {
    title: `${article.title} · Rivlr Help`,
    description: article.summary,
  };
}

/**
 * Single help article. Lives inside (app) so the sidebar / theme /
 * top chrome are inherited from the dashboard layout — feels like a
 * native page, not a docs site.
 *
 * Navigation hints at the top + bottom: breadcrumb back to /help, plus
 * prev/next links across the article catalogue order so readers can
 * step through articles without bouncing back to the index.
 */
export default async function HelpArticlePage(props: { params: Params }) {
  const { slug } = await props.params;
  const article = findArticle(slug);
  if (!article) notFound();

  const Content = HELP_CONTENT[slug];
  const idx = ARTICLES.findIndex((a) => a.slug === slug);
  const prev = idx > 0 ? ARTICLES[idx - 1] : null;
  const next = idx >= 0 && idx < ARTICLES.length - 1 ? ARTICLES[idx + 1] : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {/* Breadcrumb */}
      <nav className="text-xs text-muted font-mono">
        <Link
          href="/help"
          className="text-foreground underline-offset-4 hover:underline"
        >
          ← All help articles
        </Link>
        <span className="mx-2 opacity-50">·</span>
        <span className="uppercase tracking-wider">{article!.category}</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          {article!.title}
        </h1>
        <p className="mt-2 text-base text-muted leading-relaxed">
          {article!.summary}
        </p>
      </header>

      <article className="prose-rivlr mt-10">
        {Content ? Content() : <p>Content coming soon.</p>}
      </article>

      <hr className="my-12 border-default" />

      {/* Prev / next strip */}
      <nav
        className="grid gap-3 sm:grid-cols-2"
        aria-label="Article navigation"
      >
        {prev ? (
          <Link
            href={`/help/${prev.slug}`}
            className="rounded-lg border border-default bg-elevated p-4 hover:border-strong transition group"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted/70 font-mono">
              ← Previous
            </div>
            <div className="mt-1 text-sm font-medium">{prev.title}</div>
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link
            href={`/help/${next.slug}`}
            className="rounded-lg border border-default bg-elevated p-4 hover:border-strong transition group sm:text-right"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted/70 font-mono">
              Next →
            </div>
            <div className="mt-1 text-sm font-medium">{next.title}</div>
          </Link>
        ) : (
          <div />
        )}
      </nav>

      <p className="mt-10 text-sm text-muted leading-relaxed">
        Was this helpful? If something was missing or unclear, email{" "}
        <a
          href="mailto:support@rivlr.app"
          className="text-foreground underline-offset-4 hover:underline"
        >
          support@rivlr.app
        </a>{" "}
        and we&apos;ll fix the article.
      </p>
    </main>
  );
}
