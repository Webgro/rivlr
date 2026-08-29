"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Article } from "@/lib/help-articles";

// Drop the function-typed `content` field — server components can't pass
// functions across the boundary. The search bar only needs the metadata.
type ArticleMeta = Omit<Article, "content">;

/**
 * Client-side help search. Substring match against title + summary +
 * category. Sufficient for ~13 articles — Fuse.js would be overkill
 * and ship 50KB extra. When the catalogue grows past 50, swap in
 * fuzzy matching.
 */
export function HelpSearch({
  articles,
  categoryOrder,
}: {
  articles: ArticleMeta[];
  categoryOrder: ArticleMeta["category"][];
}) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!trimmed) return null;
    return articles.filter((a) => {
      const haystack =
        `${a.title} ${a.summary} ${a.category}`.toLowerCase();
      // All terms must appear (AND-style match — matches user
      // expectation for short queries like "csv upload").
      return trimmed.split(/\s+/).every((t) => haystack.includes(t));
    });
  }, [articles, trimmed]);

  return (
    <>
      <div className="mt-8 relative">
        <SearchIcon />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help articles…"
          autoFocus
          className="w-full rounded-lg border border-default bg-elevated pl-10 pr-4 py-3 text-sm text-foreground placeholder-muted outline-none focus:border-strong"
        />
        {trimmed && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground transition"
            aria-label="Clear search"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 6 L18 18 M18 6 L6 18" />
            </svg>
          </button>
        )}
      </div>

      {filtered ? (
        <FilteredResults articles={filtered} query={trimmed} />
      ) : (
        <CategoryGroups articles={articles} categoryOrder={categoryOrder} />
      )}
    </>
  );
}

function CategoryGroups({
  articles,
  categoryOrder,
}: {
  articles: ArticleMeta[];
  categoryOrder: ArticleMeta["category"][];
}) {
  const byCategory = new Map<string, ArticleMeta[]>();
  for (const a of articles) {
    const list = byCategory.get(a.category) ?? [];
    list.push(a);
    byCategory.set(a.category, list);
  }

  return (
    <div className="mt-10 space-y-10">
      {categoryOrder
        .filter((c) => byCategory.get(c)?.length)
        .map((category) => (
          <section key={category}>
            <h2 className="text-xs uppercase tracking-[0.2em] text-muted/70 font-mono mb-4">
              {category}
            </h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {byCategory.get(category)!.map((a) => (
                <li key={a.slug}>
                  <ArticleCard article={a} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

function FilteredResults({
  articles,
  query,
}: {
  articles: ArticleMeta[];
  query: string;
}) {
  if (articles.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-dashed border-default px-8 py-12 text-center">
        <p className="text-sm text-foreground">
          No articles match{" "}
          <span className="font-mono text-muted">&ldquo;{query}&rdquo;</span>.
        </p>
        <p className="mt-2 text-xs text-muted">
          Try a different keyword, or email{" "}
          <a
            href="mailto:hello@rivlr.app"
            className="text-foreground underline-offset-4 hover:underline"
          >
            hello@rivlr.app
          </a>{" "}
          and we&apos;ll write the article.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-xs font-medium text-muted mb-4">
        {articles.length} result{articles.length === 1 ? "" : "s"}
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {articles.map((a) => (
          <li key={a.slug}>
            <ArticleCard article={a} showCategory />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArticleCard({
  article,
  showCategory,
}: {
  article: ArticleMeta;
  showCategory?: boolean;
}) {
  return (
    <Link
      href={`/help/${article.slug}`}
      className="block h-full rounded-lg border border-default bg-elevated p-4 hover:border-strong transition group"
    >
      {showCategory && (
        <div className="text-[11px] font-medium text-muted mb-1.5">
          {article.category}
        </div>
      )}
      <div className="font-medium text-foreground group-hover:text-foreground">
        {article.title}
      </div>
      <div className="mt-1 text-xs text-muted leading-relaxed">
        {article.summary}
      </div>
    </Link>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}
