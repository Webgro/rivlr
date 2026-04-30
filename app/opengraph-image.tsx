import { ImageResponse } from "next/og";

/**
 * Auto-generated OG image for the marketing landing. Next.js wires the
 * <meta property="og:image"> tag automatically when this file exists.
 *
 * Renders at build / first request time using ImageResponse (Satori under
 * the hood). Pure JSX; no external image assets needed.
 */

export const alt = "Rivlr · Shopify Competitor Price & Stock Tracker";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          background: "#0a0a0a",
          color: "#f5f3ee",
          padding: "80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "Geist, sans-serif",
          position: "relative",
        }}
      >
        {/* Subtle dot grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Active radar dot accent — top right */}
        <div
          style={{
            position: "absolute",
            top: 96,
            right: 120,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 9999,
              background: "#FF3B30",
              boxShadow: "0 0 24px 6px rgba(255,59,48,0.6)",
            }}
          />
          <div
            style={{
              fontSize: 14,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#737373",
              fontFamily: "monospace",
            }}
          >
            Intel online
          </div>
        </div>

        {/* Wordmark — top left */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            position: "relative",
          }}
        >
          <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.02em" }}>
            rivlr
          </div>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: "#FF3B30",
              transform: "translateY(-3px)",
            }}
          />
        </div>

        {/* Headline + subhead */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#FF3B30",
              fontFamily: "monospace",
              marginBottom: 30,
            }}
          >
            Shopify · Competitor · Tracker
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 110,
              fontWeight: 600,
              letterSpacing: "-0.035em",
              lineHeight: 0.95,
              maxWidth: 980,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
              <span>Watch your</span>
              <span style={{ fontStyle: "italic", fontWeight: 400 }}>
                rivals
              </span>
            </div>
            <div>move first.</div>
          </div>
          <div
            style={{
              marginTop: 30,
              fontSize: 24,
              color: "#a3a3a3",
              maxWidth: 800,
              lineHeight: 1.4,
            }}
          >
            Hourly price + stock tracking across competitor Shopify stores.
            Instant alerts. No spreadsheets.
          </div>
        </div>

        {/* Footer row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "relative",
            color: "#737373",
            fontSize: 18,
            fontFamily: "monospace",
            letterSpacing: "0.04em",
          }}
        >
          <div>rivlr.app</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span>Free up to 5 products</span>
            <span style={{ color: "#404040" }}>·</span>
            <span>No card</span>
            <span style={{ color: "#404040" }}>·</span>
            <span>Cancel anytime</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
