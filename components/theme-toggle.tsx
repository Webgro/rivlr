"use client";

import { useEffect, useState } from "react";
import { ToggleSwitch } from "./toggle-switch";

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

  // Avoid nested buttons (the parent NavLink-style row would normally be
  // a button). Render a plain row + a single ToggleSwitch on the right
  // that owns the click. Whole row also clickable via wrapping label.
  return (
    <div
      className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface hover:text-foreground transition cursor-pointer"
      onClick={flip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          flip();
        }
      }}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <MoonIcon className="text-muted-strong opacity-80" />
      ) : (
        <SunIcon className="text-muted-strong opacity-80" />
      )}
      <span>{theme === "dark" ? "Dark" : "Light"} mode</span>
      <span
        className="ml-auto"
        // Stop the row's onClick from also firing — otherwise a click on
        // the toggle would flip twice.
        onClick={(e) => {
          e.stopPropagation();
          flip();
        }}
      >
        <ToggleSwitch
          checked={theme === "light"}
          size="md"
          ariaLabel="Toggle light mode"
        />
      </span>
    </div>
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
