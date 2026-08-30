/**
 * Help article metadata: slug, title, summary, category.
 *
 * Plain TS on purpose, with no React imports, so server components and
 * the sitemap can read the catalogue without pulling in the article
 * bodies. The bodies live in lib/help-content.tsx, keyed by the same
 * slug.
 *
 * The order below is the order of the help index and of the prev/next
 * strip at the foot of every article, so it reads as a course: what the
 * product is, how setup works, then one article per surface, then plans
 * and billing, then the questions people actually ask.
 *
 * Summaries carry the words a shop owner would type into the search box
 * on /help. That box matches title + summary + category as plain
 * substrings, so a word missing from those three fields is a word that
 * cannot be searched for. "Spreadsheet", "CSV", "export", "sold",
 * "cancel", "limit" and the page names all earn their place that way.
 */

import type { ReactNode } from "react";

export interface Article {
  slug: string;
  title: string;
  summary: string;
  category: "Getting started" | "Features" | "Account & billing" | "Troubleshooting";
  content: () => ReactNode;
}

export const ARTICLES: Article[] = [
  {
    slug: "getting-started",
    title: "Getting started with Rivlr",
    summary:
      "What Rivlr does: competitor prices, competitor stock, and what rivals sell that you don't.",
    category: "Getting started",
    content: () => null, // bodies live in lib/help-content.tsx
  },
  {
    slug: "guided-setup",
    title: "Guided setup for a new account",
    summary:
      "Your shop address, your first competitor, and picking products you both sell. What happens on the welcome screens.",
    category: "Getting started",
    content: () => null,
  },
  {
    slug: "adding-competitors",
    title: "Adding a competitor shop",
    summary:
      "Add a rival Shopify shop, what Rivlr reads from it, and how many shops each plan allows.",
    category: "Getting started",
    content: () => null,
  },
  {
    slug: "product-matching",
    title: "How Rivlr matches products you both sell",
    summary:
      "Matching by product code and product name, and why some rows show no price gap because the sizes differ.",
    category: "Getting started",
    content: () => null,
  },
  {
    slug: "adding-products",
    title: "Adding competitor products by link",
    summary:
      "Paste product links, a whole collection, or upload a spreadsheet of links to add rival products by hand.",
    category: "Getting started",
    content: () => null,
  },
  {
    slug: "prices",
    title: "The Prices page",
    summary:
      "Your products beside the cheapest rival price, with search, filters, tick-boxes and bulk actions.",
    category: "Features",
    content: () => null,
  },
  {
    slug: "price-export",
    title: "Exporting prices to a spreadsheet",
    summary:
      "Download a CSV of your price, their price, the gap and an empty New price column, then upload to Shopify yourself.",
    category: "Features",
    content: () => null,
  },
  {
    slug: "stock",
    title: "The Stock page",
    summary:
      "Rival versions of the things you sell, out of stock first, with search, filters, bulk actions and a spreadsheet export.",
    category: "Features",
    content: () => null,
  },
  {
    slug: "discovery",
    title: "The Discovery page",
    summary:
      "Competitor products you do not sell yet, ordered by how many units are actually selling.",
    category: "Features",
    content: () => null,
  },
  {
    slug: "units-sold",
    title: "Units sold, and why it is sometimes blank",
    summary:
      "How Rivlr works out that a rival sold 87 in 7 days, why it is a floor rather than an exact figure, and why many rows show nothing.",
    category: "Features",
    content: () => null,
  },
  {
    slug: "reading-the-dashboard",
    title: "The Dashboard and Opportunities",
    summary:
      "What the cards, movers and activity feed mean, and the two lists on the Opportunities page.",
    category: "Features",
    content: () => null,
  },
  {
    slug: "notifications",
    title: "Email alerts and the weekly summary",
    summary:
      "Get an email when a rival sells out or drops a price, choose who receives them, and turn them on in bulk.",
    category: "Features",
    content: () => null,
  },
  {
    slug: "tags",
    title: "Tags, favourites and notes",
    summary:
      "Colour-coded labels, starred products and free-text notes for keeping a big list organised.",
    category: "Features",
    content: () => null,
  },
  {
    slug: "plans-and-limits",
    title: "Plans, product limits and competitor limits",
    summary:
      "Free, Starter, Growth and Scale: how many products, how many competitor shops, and how often prices are checked.",
    category: "Account & billing",
    content: () => null,
  },
  {
    slug: "billing-and-cancelling",
    title: "Changing plan, card details and cancelling",
    summary:
      "Upgrade or downgrade in the app, update your card or find invoices, and what happens when you cancel.",
    category: "Account & billing",
    content: () => null,
  },
  {
    slug: "troubleshooting",
    title: "Common questions and fixes",
    summary:
      "Blank sales figures, missing price gaps, products that have not updated yet, and being unable to add another competitor.",
    category: "Troubleshooting",
    content: () => null,
  },
];

export function findArticle(slug: string): Article | null {
  return ARTICLES.find((a) => a.slug === slug) ?? null;
}
