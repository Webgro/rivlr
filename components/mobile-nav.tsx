"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./wordmark";
import {
  PRIMARY_NAV,
  SECONDARY_NAV,
  ADMIN_NAV,
  type NavItem,
} from "./sidebar";

/**
 * Mobile navigation. The desktop sidebar is hidden below the md
 * breakpoint, which previously left phones with no navigation at all.
 * This renders a sticky top bar (wordmark + hamburger) and a full-screen
 * drawer with the same nav items as the sidebar.
 *
 * The drawer closes automatically on route change so tapping a link
 * never leaves the overlay hanging over the new page.
 */
export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const secondary = isAdmin ? [...SECONDARY_NAV, ADMIN_NAV] : SECONDARY_NAV;

  // Close when navigation happens.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Top bar, phones only */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between border-b border-default bg-elevated px-4 py-3">
        <Link href="/dashboard">
          <Wordmark size="lg" />
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-default bg-surface text-foreground"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 top-[57px] z-40 overflow-y-auto bg-surface">
          <nav className="px-3 py-4">
            <ul className="space-y-0.5">
              {PRIMARY_NAV.map((item) => (
                <DrawerLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item)}
                />
              ))}
            </ul>
            <div className="my-4 border-t border-default" />
            <ul className="space-y-0.5">
              {secondary.map((item) => (
                <DrawerLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item)}
                />
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}

function isActive(pathname: string, item: NavItem) {
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function DrawerLink({ item, active }: { item: NavItem; active: boolean }) {
  const { Icon } = item;
  return (
    <li>
      <Link
        href={item.href}
        className={`flex items-center gap-3 rounded-md px-3 py-3 text-base transition ${
          active
            ? "bg-elevated text-foreground"
            : "text-muted hover:bg-elevated hover:text-foreground"
        }`}
      >
        <Icon
          className={active ? "text-signal" : "text-muted-strong opacity-80"}
          size={20}
        />
        {item.label}
      </Link>
    </li>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 7 H20 M4 12 H20 M4 17 H20" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  );
}
