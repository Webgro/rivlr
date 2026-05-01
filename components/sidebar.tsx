"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./theme-toggle";
import { Wordmark } from "./wordmark";
import {
  DashboardIcon,
  ProductsIcon,
  ActivityIcon,
  DiscoverIcon,
  SuggestionsIcon,
  TagsIcon,
  StoresIcon,
  MyProductsIcon,
  OpportunitiesIcon,
  SettingsIcon,
  HelpIcon,
  SignOutIcon,
} from "./sidebar-icons";

interface NavItem {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; size?: number }>;
}

// Three groups for clarity. Order = priority of the daily user flow:
// "Where's the action?" → "What am I tracking?" → "Manage".
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Today",
    items: [
      { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
      { href: "/opportunities", label: "Opportunities", Icon: OpportunitiesIcon },
      { href: "/activity", label: "Activity", Icon: ActivityIcon },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { href: "/my-products", label: "My products", Icon: MyProductsIcon },
      { href: "/products", label: "Competitors", Icon: ProductsIcon },
      { href: "/discover", label: "Discover", Icon: DiscoverIcon },
      { href: "/products/suggestions", label: "Suggestions", Icon: SuggestionsIcon },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/stores", label: "Stores", Icon: StoresIcon },
      { href: "/tags", label: "Tags", Icon: TagsIcon },
    ],
  },
];

// Flat list used for active-route detection.
const PRIMARY_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

const SECONDARY_NAV: NavItem[] = [
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
  { href: "/help", label: "Help", Icon: HelpIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  // Pick the longest matching nav item as 'active' so /products/suggestions
  // doesn't also light up /products.
  const allNav = [...PRIMARY_NAV, ...SECONDARY_NAV];
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
      {/* Header — bigger wordmark */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-default">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Wordmark size="xl" />
        </Link>
        <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted font-mono border border-default">
          P1
        </span>
      </div>

      {/* Primary nav, grouped */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.2em] text-muted/70 font-mono">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item)} />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom: Settings + Help + Theme + Sign out */}
      <div className="border-t border-default px-3 py-3 space-y-0.5">
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item)} />
        ))}

        <ThemeToggle />

        {/* Sign out */}
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted hover:bg-surface hover:text-foreground transition"
          >
            <SignOutIcon className="text-muted opacity-70 group-hover:opacity-100" size={20} />
            Sign out
          </button>
        </form>
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
