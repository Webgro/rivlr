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

export default async function HelpArticlePage(props: { params: Params }) {
  const { slug } = await props.params;
  const article = findArticle(slug);
  if (!article) notFound();

  const Content = HELP_CONTENT[slug];

  return (
    <article className="mx-auto max-w-3xl px-6 py-12 prose-rivlr">
      <Link
        href="/help"
        className="text-xs uppercase tracking-wider text-muted font-mono hover:text-foreground"
      >
        ← All help articles
      </Link>

      <h1 className="mt-4">{article!.title}</h1>
      <p className="lead">{article!.summary}</p>

      {Content ? Content() : <p>Content coming soon.</p>}

      <hr style={{ borderColor: "var(--default-border)", margin: "48px 0 24px" }} />
      <p className="text-sm text-muted">
        Was this helpful? If something was missing or unclear, email{" "}
        <a href="mailto:support@rivlr.app">support@rivlr.app</a> and I'll fix
        the article.
      </p>
    </article>
  );
}
