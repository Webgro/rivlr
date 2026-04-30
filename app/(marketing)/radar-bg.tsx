/**
 * Hero background. Replaced the busy radar dot-grid with a cleaner two-glow
 * gradient mesh + a slow vertical scan line. Higher contrast for the
 * foreground text, more cinematic for the brand.
 */
export function RadarBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    >
      {/* Top-right red signal glow — establishes the brand accent */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          right: "-10%",
          width: "70vw",
          height: "70vh",
          background:
            "radial-gradient(closest-side, rgba(255,59,48,0.18), rgba(255,59,48,0))",
          filter: "blur(60px)",
        }}
      />
      {/* Bottom-left cooler glow — depth without competing */}
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          left: "-15%",
          width: "60vw",
          height: "60vh",
          background:
            "radial-gradient(closest-side, rgba(40,40,80,0.4), rgba(0,0,0,0))",
          filter: "blur(80px)",
        }}
      />
      {/* Subtle constellation lines — fixed positions, low opacity, only
          implies network/intel without the dot-grid noise */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0"
        style={{ opacity: 0.35 }}
      >
        <defs>
          <linearGradient id="line-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        {/* A few hand-placed constellation segments — too few to feel busy,
            enough to feel like there's something being plotted */}
        <line x1="120" y1="80" x2="380" y2="180" stroke="url(#line-fade)" strokeWidth="1" />
        <line x1="380" y1="180" x2="620" y2="120" stroke="url(#line-fade)" strokeWidth="1" />
        <line x1="1100" y1="200" x2="1380" y2="160" stroke="url(#line-fade)" strokeWidth="1" />
        <line x1="180" y1="700" x2="440" y2="780" stroke="url(#line-fade)" strokeWidth="1" />
        <line x1="980" y1="720" x2="1240" y2="640" stroke="url(#line-fade)" strokeWidth="1" />
        {/* Small node points at line vertices */}
        {[
          [120, 80], [380, 180], [620, 120], [1100, 200], [1380, 160],
          [180, 700], [440, 780], [980, 720], [1240, 640],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.5} fill="rgba(255,255,255,0.5)" />
        ))}
      </svg>

      {/* Slow vertical scan line — gives the "live monitoring" feel */}
      <div className="scan-line" />

      <style>{`
        .scan-line {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 240px;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            rgba(255, 59, 48, 0.04) 45%,
            rgba(255, 59, 48, 0.08) 50%,
            rgba(255, 59, 48, 0.04) 55%,
            transparent 100%
          );
          animation: scan 9s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes scan {
          0% { transform: translateY(-30vh); }
          100% { transform: translateY(140vh); }
        }
        @media (prefers-reduced-motion: reduce) {
          .scan-line { display: none; }
        }
      `}</style>
    </div>
  );
}
