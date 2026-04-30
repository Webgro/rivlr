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

  if (!mounted) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 text-sm text-muted">
        <span className="h-[18px] w-[18px]" />
        <span>Theme</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={flip}
      className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface hover:text-foreground transition"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <MoonIcon className="text-muted-strong opacity-80" />
      ) : (
        <SunIcon className="text-muted-strong opacity-80" />
      )}
      <span>{theme === "dark" ? "Dark" : "Light"} mode</span>
      {/* Toggle switch on the right */}
      <span
        className={`ml-auto relative h-4 w-7 rounded-full border transition ${
          theme === "dark"
            ? "border-strong bg-surface"
            : "border-strong bg-signal/20"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-[1px] h-2.5 w-2.5 rounded-full bg-foreground transition-transform ${
            theme === "dark" ? "translate-x-[2px]" : "translate-x-[14px]"
          }`}
        />
      </span>
    </button>
  );
}

function MoonIcon({ className }: { className?: string }) {
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
      className={className}
    >
      <path d="M21 12.79 A9 9 0 1 1 11.21 3 a7 7 0 0 0 9.79 9.79 z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
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
      className={className}
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2 v2 M12 20 v2 M4.93 4.93 l1.41 1.41 M17.66 17.66 l1.41 1.41 M2 12 h2 M20 12 h2 M4.93 19.07 l1.41 -1.41 M17.66 6.34 l1.41 -1.41" />
    </svg>
  );
}

/**
 * Inline script to apply the theme as early as possible to avoid flash.
 * Rendered in the root layout's <head>.
 */
export const themeInitScript = `
(function(){try{var t=localStorage.getItem("rivlr-theme")||"dark";document.documentElement.setAttribute("data-theme",t);}catch(e){}})();
`;
