"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/dashboard", label: "Products", icon: "◉" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:fixed md:left-0 md:top-0 md:h-screen md:w-56 md:flex-col md:border-r md:border-default md:bg-elevated">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-default">
        <span className="block h-6 w-6 rounded-md bg-foreground relative flex-shrink-0">
          <span className="absolute left-[6px] top-[6px] h-3 w-1 bg-surface" />
          <span className="absolute right-[6px] top-[6px] h-2 w-1 bg-signal" />
        </span>
        <span className="font-semibold tracking-tight text-foreground">rivlr</span>
        <span className="ml-auto rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted font-mono border border-default">
          P1
        </span>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
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
