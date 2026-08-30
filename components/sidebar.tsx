"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./wordmark";
import {
  DashboardIcon,
  ProductsIcon,
  DiscoverIcon,
  StoresIcon,
  MyProductsIcon,
  OpportunitiesIcon,
  SettingsIcon,
  ProfileIcon,
  BillingIcon,
  AdminIcon,
  HelpIcon,
} from "./sidebar-icons";

export interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; size?: number }>;
}

/**
 * One entry per thing the product actually does.
 *
 * Exported so the mobile drawer (components/mobile-nav.tsx) renders the
 * exact same set; there is one source of truth for what the nav holds.
 *
 * This used to be six entries, five of which were the same two nouns
 * seen from different angles: Watchlist and My products were both
 * products with prices, Discover was products not yet followed,
 * Opportunities was products filtered by a rule, Stores was where
 * products came from. That is a map of the database, and it made the
 * user learn the schema before they could get anywhere.
 *
 * These four are the three jobs the product exists to do, plus the
 * overview:
 *   Prices     what competitors charge for what I sell
 *   Stock      when a competitor runs out of something I sell
 *   Discovery  what they sell that I don't, and what moves
 *
 * Stores moved to Settings: choosing which shops to watch is setup you
 * do rarely, not a place you visit. Tags live in the Prices filter bar.
 *
 * Prices points at /my-products because that page already is what
 * Prices means: your product beside the cheapest competitor selling the
 * same thing. The old Watchlist at /products is the raw table of
 * everything being watched. It keeps its bulk editing and stays
 * reachable from Prices, but it is a tool rather than a destination,
 * so it is no longer a top-level choice.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/opportunities", label: "Opportunities", Icon: OpportunitiesIcon },
  { href: "/my-products", label: "Prices", Icon: ProductsIcon },
  { href: "/stock", label: "Stock", Icon: MyProductsIcon },
  { href: "/discovery", label: "Discovery", Icon: DiscoverIcon },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: "/stores", label: "Competitors", Icon: StoresIcon },
  { href: "/profile", label: "Profile", Icon: ProfileIcon },
  { href: "/billing", label: "Billing", Icon: BillingIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
  { href: "/help", label: "Help", Icon: HelpIcon },
];

export const ADMIN_NAV: NavItem = {
  href: "/admin",
  label: "Admin",
  Icon: AdminIcon,
};

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const secondary = isAdmin ? [...SECONDARY_NAV, ADMIN_NAV] : SECONDARY_NAV;

  // Pick the longest matching nav item as 'active' so /products/suggestions
  // doesn't also light up /products.
  const allNav = [...PRIMARY_NAV, ...secondary];
  const candidates = allNav.filter(
    (n) => pathname === n.href || pathname.startsWith(n.href + "/"),
  );
  const longest = candidates.reduce<NavItem | null>(
    (best, n) => (!best || n.href.length > best.href.length ? n : best),
    null,
  );

  function isActive(item: NavItem) {
    return longest?.href === item.href;
  }

  return (
    <aside className="hidden md:flex md:fixed md:left-0 md:top-0 md:h-screen md:w-60 md:flex-col md:border-r md:border-default md:bg-elevated">
      {/* Header */}
      <div className="flex items-center px-5 py-5 border-b border-default">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Wordmark size="xl" />
        </Link>
      </div>

      {/* Primary nav — flat list, no group labels */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item)} />
          ))}
        </ul>
      </nav>

      {/* Bottom: Profile / Billing / Settings / Help. Theme toggle now
          lives under /settings; Sign out under /profile. */}
      <div className="border-t border-default px-3 py-3">
        {/* NavLink renders <li>, so wrap it in a <ul> to suppress the
            browser's default disc bullets that show up on orphan <li>. */}
        <ul className="space-y-0.5">
          {secondary.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item)} />
          ))}
        </ul>
      </div>
    </aside>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { Icon } = item;
  return (
    <li>
      <Link
        href={item.href}
        className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
          active
            ? "bg-surface text-foreground"
            : "text-muted hover:bg-surface hover:text-foreground"
        }`}
      >
        <Icon
          className={`flex-shrink-0 transition ${
            active ? "text-signal" : "text-muted-strong opacity-80"
          }`}
          size={18}
        />
        <span>{item.label}</span>
        {active && (
          <span
            className="ml-auto h-1.5 w-1.5 rounded-full bg-signal"
            aria-hidden
          />
        )}
      </Link>
    </li>
  );
}
