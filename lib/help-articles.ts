/**
 * Help articles content. Stored as JSX (not markdown) so we can embed
 * components — TagChips, code blocks, screenshots etc. — without parsing.
 * Each article has a slug, title, summary, category, and content function.
 *
 * Screenshots: paths under /help/screenshots/X.png — drop real PNGs in the
 * public folder later. The current setup uses styled placeholder boxes.
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
    summary: "Add your first competitor product and see what gets tracked.",
    category: "Getting started",
    content: () => null, // populated in JSX below
  },
  {
    slug: "adding-products",
    title: "Adding Shopify product URLs",
    summary: "How to track individual products one or many at a time.",
    category: "Getting started",
  content: () => null,
  },
  {
    slug: "adding-collections",
    title: "Tracking entire collections",
    summary: "Paste a collection URL and track every product in it.",
    category: "Getting started",
  content: () => null,
  },
  {
    slug: "csv-upload",
    title: "Bulk import via CSV",
    summary: "Upload a spreadsheet of URLs to track in one go.",
    category: "Getting started",
  content: () => null,
  },
  {
    slug: "reading-the-dashboard",
    title: "Reading the dashboard",
    summary: "Insights cards, opportunities, activity feed — what each shows.",
    category: "Features",
  content: () => null,
  },
  {
    slug: "tags",
    title: "Tags and colour coding",
    summary: "Organise tracked products with colour-coded labels.",
    category: "Features",
  content: () => null,
  },
  {
    slug: "linking-products",
    title: "Linking products across stores",
    summary: "Group the same item sold by different competitors.",
    category: "Features",
  content: () => null,
  },
  {
    slug: "notifications",
    title: "Setting up email alerts",
    summary: "Get notified when a competitor goes out of stock or drops a price.",
    category: "Features",
  content: () => null,
  },
  {
    slug: "notes",
    title: "Adding notes to a product",
    summary: "Free-text context for products you track.",
    category: "Features",
  content: () => null,
  },
  {
    slug: "compare",
    title: "Comparing products side by side",
    summary: "Overlay multiple competitors' price history on one chart.",
    category: "Features",
  content: () => null,
  },
  {
    slug: "troubleshooting-crawls",
    title: "Why isn't my product crawling?",
    summary: "What to check when prices or stock aren't updating.",
    category: "Troubleshooting",
  content: () => null,
  },
];

export function findArticle(slug: string): Article | null {
  return ARTICLES.find((a) => a.slug === slug) ?? null;
}
