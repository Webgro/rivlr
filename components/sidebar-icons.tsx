/**
 * Stroke-based SVG icons for the sidebar. Sized 20×20 by default — bigger
 * and cleaner than the single-character glyphs we had before. All icons
 * use currentColor so they pick up the active/inactive nav text colours.
 */

interface IconProps {
  className?: string;
  size?: number;
}

const baseProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function DashboardIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...baseProps}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

export function ProductsIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M3 7 L12 3 L21 7 L12 11 L3 7 Z" />
      <path d="M3 7 V17 L12 21 V11" />
      <path d="M21 7 V17 L12 21" />
    </svg>
  );
}

export function ActivityIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M3 12 H7 L9 6 L13 18 L15 12 H21" />
    </svg>
  );
}

export function SuggestionsIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M9 12 H4 a3 3 0 0 1 0 -6 h2 a3 3 0 0 1 3 3 v0" />
      <path d="M15 12 h5 a3 3 0 0 1 0 6 h-2 a3 3 0 0 1 -3 -3 v0" />
      <path d="M9 12 L15 12" />
    </svg>
  );
}

export function TagsIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M20.59 13.41 L13.42 20.58 a2 2 0 0 1 -2.83 0 L3 13 V3 h10 l7.59 7.59 a2 2 0 0 1 0 2.82 z" />
      <circle cx="7" cy="7" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function SettingsIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...baseProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15 a1.65 1.65 0 0 0 .33 1.82 l.06 .06 a2 2 0 0 1 -2.83 2.83 l-.06 -.06 a1.65 1.65 0 0 0 -1.82 -.33 1.65 1.65 0 0 0 -1 1.51 V21 a2 2 0 0 1 -4 0 v-.09 A1.65 1.65 0 0 0 9 19.4 a1.65 1.65 0 0 0 -1.82 .33 l-.06 .06 a2 2 0 0 1 -2.83 -2.83 l.06 -.06 a1.65 1.65 0 0 0 .33 -1.82 1.65 1.65 0 0 0 -1.51 -1 H3 a2 2 0 0 1 0 -4 h.09 A1.65 1.65 0 0 0 4.6 9 a1.65 1.65 0 0 0 -.33 -1.82 l-.06 -.06 a2 2 0 0 1 2.83 -2.83 l.06 .06 a1.65 1.65 0 0 0 1.82 .33 H9 a1.65 1.65 0 0 0 1 -1.51 V3 a2 2 0 0 1 4 0 v.09 a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82 -.33 l.06 -.06 a2 2 0 0 1 2.83 2.83 l-.06 .06 a1.65 1.65 0 0 0 -.33 1.82 V9 a1.65 1.65 0 0 0 1.51 1 H21 a2 2 0 0 1 0 4 h-.09 a1.65 1.65 0 0 0 -1.51 1 z" />
    </svg>
  );
}

export function HelpIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...baseProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5 a2.5 2.5 0 0 1 5 0 c0 1.5 -2 2 -2.5 3" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function StoresIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M4 7 L5 4 H19 L20 7" />
      <path d="M4 7 V20 H20 V7" />
      <path d="M4 7 H20" />
      <path d="M9 7 V11 a3 3 0 0 1 -6 0 V7" />
      <path d="M15 7 V11 a3 3 0 0 1 -6 0 V7" />
      <path d="M21 7 V11 a3 3 0 0 1 -6 0 V7" />
    </svg>
  );
}

export function DiscoverIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...baseProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M16.24 7.76 L13.5 13.5 L7.76 16.24 L10.5 10.5 z" />
    </svg>
  );
}

export function SignOutIcon({ className, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...baseProps}>
      <path d="M9 21 H5 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 h4" />
      <path d="M16 17 L21 12 L16 7" />
      <path d="M21 12 H9" />
    </svg>
  );
}
