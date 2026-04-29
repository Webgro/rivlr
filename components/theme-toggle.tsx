"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (typeof window !== "undefined"
      ? (localStorage.getItem("rivlr-theme") as Theme | null)
      : null) ?? "dark";
    setTheme(stored);
    document.documentElement.setAttribute("data-theme", stored);
    setMounted(true);
  }, []);

  function flip() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("rivlr-theme", next);
  }

  // Render a placeholder during SSR / before hydration to avoid layout shift.
  if (!mounted) {
    return (
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Theme</span>
        <span className="font-mono">…</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={flip}
      className="flex w-full items-center justify-between rounded-md border border-default bg-surface px-3 py-1.5 text-xs text-muted transition hover:text-foreground hover:border-strong"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span className="flex items-center gap-2">
        {theme === "dark" ? "🌙" : "☀️"}
        <span>{theme === "dark" ? "Dark" : "Light"}</span>
      </span>
      <span className="font-mono uppercase tracking-wider opacity-70">flip</span>
    </button>
  );
}

/**
 * Inline script to apply the theme as early as possible to avoid flash.
 * Rendered in the root layout's <head>.
 */
export const themeInitScript = `
(function(){try{var t=localStorage.getItem("rivlr-theme")||"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();
`;
