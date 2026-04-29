"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◐" },
  { href: "/products", label: "Products", icon: "◉" },
  { href: "/products/suggestions", label: "Suggestions", icon: "⤧" },
  { href: "/tags", label: "Tags", icon: "▤" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:fixed md:left-0 md:top-0 md:h-screen md:w-56 md:flex-col md:border-r md:border-default md:bg-elevated">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-default">
        <Wordmark />
        <span className="ml-auto rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted font-mono border border-default">
          P1
        </span>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {NAV.map((item) => {
            // Pick the longest matching href among siblings as the active one,
            // so `/products/suggestions` lights up "Suggestions" and not
            // "Products" (which would also prefix-match).
            const candidates = NAV.filter(
              (n) => pathname === n.href || pathname.startsWith(n.href + "/"),
            );
            const longest = candidates.reduce<typeof item | null>(
              (best, n) =>
                !best || n.href.length > best.href.length ? n : best,
              null,
            );
            const active = longest?.href === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                    active
                      ? "bg-surface text-foreground"
                      : "text-muted hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <span className="font-mono text-xs opacity-70">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-default p-4 space-y-3">
        <ThemeToggle />
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="w-full text-left text-xs text-muted hover:text-foreground"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
