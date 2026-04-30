import Link from "next/link";
import { ARTICLES } from "@/lib/help-articles";

export const metadata = { title: "Help · Rivlr" };

export default function HelpIndexPage() {
  const byCategory: Record<string, typeof ARTICLES> = {};
  for (const a of ARTICLES) {
    if (!byCategory[a.category]) byCategory[a.category] = [];
    byCategory[a.category].push(a);
  }
  const categoryOrder: Array<keyof typeof byCategory> = [
    "Getting started",
    "Features",
    "Account & billing",
    "Troubleshooting",
  ];

  return (
    <section className="mx-auto max-w-4xl px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Help</h1>
        <p className="mt-2 text-sm text-muted">
          Short guides for the things people ask about most. Can't find what
          you need? Email{" "}
          <a
            href="mailto:support@rivlr.app"
            className="underline hover:text-foreground"
          >
            support@rivlr.app
          </a>
          .
        </p>
      </div>

      <div className="mt-10 space-y-10">
        {categoryOrder
          .filter((c) => byCategory[c]?.length)
          .map((category) => (
            <section key={category}>
              <h2 className="text-xs uppercase tracking-wider text-muted font-mono mb-4">
                {category}
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {byCategory[category].map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/help/${a.slug}`}
                      className="block rounded-lg border border-default bg-elevated p-4 hover:border-strong transition"
                    >
                      <div className="font-medium">{a.title}</div>
                      <div className="mt-1 text-xs text-muted">
                        {a.summary}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
      </div>
    </section>
  );
}
