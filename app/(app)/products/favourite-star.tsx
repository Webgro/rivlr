"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleFavourite } from "./actions";

/**
 * Compact star toggle for the product row. Uses a form action so it works
 * without JS and benefits from useTransition for snappy feedback.
 */
export function FavouriteStar({
  id,
  initial,
}: {
  id: string;
  initial: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const fd = new FormData();
    fd.set("id", id);
    fd.set("value", String(!initial));
    startTransition(async () => {
      await toggleFavourite(fd);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title={initial ? "Remove from favourites" : "Add to favourites"}
      aria-label={initial ? "Remove from favourites" : "Add to favourites"}
      className={`flex-shrink-0 rounded-md p-1.5 transition ${
        initial
          ? "text-yellow-400 hover:text-yellow-300"
          : "text-muted opacity-50 hover:opacity-100 hover:text-yellow-400"
      } ${pending ? "opacity-40" : ""}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={initial ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2 L14.5 8.5 L21 9.5 L16 14 L17.5 21 L12 17.5 L6.5 21 L8 14 L3 9.5 L9.5 8.5 Z" />
      </svg>
    </button>
  );
}
