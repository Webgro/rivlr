/**
 * Live status pill — small green-on-near-black indicator that adds the
 * "we're watching right now" texture. The dot pulses, the text shows a
 * recent sweep timestamp.
 */
export function LivePill() {
  // Format current time as HH:MM in GMT — same on server + client because
  // we use UTC. Renders consistent without hydration mismatch.
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-[#0d0d0d] pl-2.5 pr-3 py-1 text-[10px] uppercase tracking-[0.18em] font-mono text-neutral-400">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-signal opacity-75 animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
      </span>
      Intel online · last sweep {hh}:{mm} GMT
    </span>
  );
}
