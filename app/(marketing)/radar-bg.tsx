/**
 * Subtle radar-grid background. Dots arranged on a coordinate grid with a
 * single 'live' dot pulsing in red — implies an ongoing sweep without
 * being noisy. Pure SVG + CSS keyframes; no JS.
 */
export function RadarBackground() {
  // Build the dot grid procedurally so we don't have to hand-position
  // hundreds of circles.
  const cols = 28;
  const rows = 18;
  const spacing = 60;
  const dots: { x: number; y: number; key: string }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push({ x: c * spacing, y: r * spacing, key: `${r}-${c}` });
    }
  }
  // Pick a few "active" dots that pulse red.
  const activeKeys = new Set(["3-7", "9-19", "13-3", "5-22", "11-13"]);

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${cols * spacing} ${rows * spacing}`}
        preserveAspectRatio="xMidYMid slice"
        className="opacity-[0.5]"
      >
        <defs>
          <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,1)" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {dots.map((d) => {
          const active = activeKeys.has(d.key);
          return (
            <circle
              key={d.key}
              cx={d.x}
              cy={d.y}
              r={active ? 2 : 1}
              fill={active ? "#ff3b30" : "rgba(255,255,255,0.16)"}
              filter={active ? "url(#glow)" : undefined}
              className={active ? "radar-pulse" : undefined}
            />
          );
        })}
        <rect
          width={cols * spacing}
          height={rows * spacing}
          fill="url(#vignette)"
        />
      </svg>
      <style>{`
        @keyframes radar-pulse {
          0%, 100% { opacity: 0.3; r: 1.5; }
          50% { opacity: 1; r: 3; }
        }
        .radar-pulse {
          animation: radar-pulse 3s ease-in-out infinite;
          transform-origin: center;
        }
        .radar-pulse:nth-of-type(2) { animation-delay: 0.4s; }
        .radar-pulse:nth-of-type(3) { animation-delay: 1.1s; }
        .radar-pulse:nth-of-type(4) { animation-delay: 1.8s; }
        .radar-pulse:nth-of-type(5) { animation-delay: 2.5s; }
      `}</style>
    </div>
  );
}
