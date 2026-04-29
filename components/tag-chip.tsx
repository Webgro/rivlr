import Link from "next/link";
import { type TagColor } from "@/lib/db/schema";

/**
 * Tag display palette. Each colour has a tinted background, foreground text,
 * and a slightly darker border. Designed to read on both light and dark
 * surfaces — uses semi-transparent fills + the colour's own foreground for
 * the text. Consistent across themes.
 */
export const TAG_COLOURS: Record<
  TagColor,
  { bg: string; fg: string; border: string }
> = {
  gray:   { bg: "rgba(115,115,115,0.18)", fg: "#a3a3a3", border: "rgba(115,115,115,0.35)" },
  red:    { bg: "rgba(239,68,68,0.15)",   fg: "#fca5a5", border: "rgba(239,68,68,0.35)" },
  orange: { bg: "rgba(249,115,22,0.15)",  fg: "#fdba74", border: "rgba(249,115,22,0.35)" },
  yellow: { bg: "rgba(234,179,8,0.18)",   fg: "#fde047", border: "rgba(234,179,8,0.4)" },
  green:  { bg: "rgba(34,197,94,0.15)",   fg: "#86efac", border: "rgba(34,197,94,0.35)" },
  blue:   { bg: "rgba(59,130,246,0.15)",  fg: "#93c5fd", border: "rgba(59,130,246,0.35)" },
  purple: { bg: "rgba(168,85,247,0.15)",  fg: "#d8b4fe", border: "rgba(168,85,247,0.35)" },
  pink:   { bg: "rgba(236,72,153,0.15)",  fg: "#f9a8d4", border: "rgba(236,72,153,0.35)" },
};

// Light-mode foreground (deeper saturation reads better on cream).
const TAG_COLOURS_LIGHT_FG: Record<TagColor, string> = {
  gray:   "#525252",
  red:    "#b91c1c",
  orange: "#c2410c",
  yellow: "#a16207",
  green:  "#15803d",
  blue:   "#1d4ed8",
  purple: "#7e22ce",
  pink:   "#be185d",
};

interface TagChipProps {
  name: string;
  color?: TagColor;
  href?: string;
  size?: "sm" | "md";
  onClick?: (e: React.MouseEvent) => void;
}

export function TagChip({
  name,
  color = "gray",
  href,
  size = "sm",
  onClick,
}: TagChipProps) {
  const palette = TAG_COLOURS[color] ?? TAG_COLOURS.gray;
  const lightFg = TAG_COLOURS_LIGHT_FG[color] ?? TAG_COLOURS_LIGHT_FG.gray;

  const styles = {
    "--chip-bg": palette.bg,
    "--chip-fg": palette.fg,
    "--chip-fg-light": lightFg,
    "--chip-border": palette.border,
  } as React.CSSProperties;

  const sizeClass =
    size === "md" ? "px-2 py-0.5 text-[11px]" : "px-1.5 py-0.5 text-[10px]";

  const className = `tag-chip inline-flex items-center gap-1 rounded font-mono uppercase tracking-wider ${sizeClass}`;

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={className}
        style={styles}
      >
        #{name}
      </Link>
    );
  }
  return (
    <span className={className} style={styles}>
      #{name}
    </span>
  );
}
