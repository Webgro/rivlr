"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SnapshotPoint {
  t: number;
  total: number | null;
  out: number | null;
}

const SIGNAL = "#FF3B30";
const GREEN = "#22c55e";

/**
 * Lightweight trend lines for the per-store profile. Two charts:
 *   - CatalogueTrendChart: total product count over time. Reveals how
 *     aggressively the competitor is adding SKUs.
 *   - StockoutTrendChart: out-of-stock count (and implicit %). Spikes
 *     mean either viral demand or supply chain trouble.
 */
export function CatalogueTrendChart({ data }: { data: SnapshotPoint[] }) {
  const points = data.filter((d) => d.total !== null);
  return (
    <div className="mt-3 h-44 w-full rounded-lg border border-default bg-elevated p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.18)" />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) =>
              new Date(t).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            }
            stroke="currentColor"
            fontSize={10}
            opacity={0.5}
          />
          <YAxis
            stroke="currentColor"
            fontSize={10}
            opacity={0.5}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface, #0d0d0d)",
              border: "1px solid rgba(127,127,127,0.3)",
              fontSize: 12,
              borderRadius: 6,
            }}
            labelFormatter={(t) => new Date(t).toLocaleDateString()}
            formatter={(v) => [Number(v).toLocaleString(), "Products"]}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke={GREEN}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StockoutTrendChart({ data }: { data: SnapshotPoint[] }) {
  const points = data.filter((d) => d.out !== null);
  return (
    <div className="mt-3 h-44 w-full rounded-lg border border-default bg-elevated p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,127,127,0.18)" />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) =>
              new Date(t).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })
            }
            stroke="currentColor"
            fontSize={10}
            opacity={0.5}
          />
          <YAxis
            stroke="currentColor"
            fontSize={10}
            opacity={0.5}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface, #0d0d0d)",
              border: "1px solid rgba(127,127,127,0.3)",
              fontSize: 12,
              borderRadius: 6,
            }}
            labelFormatter={(t) => new Date(t).toLocaleDateString()}
            formatter={(v) => [String(v), "Out of stock"]}
          />
          <Line
            type="monotone"
            dataKey="out"
            stroke={SIGNAL}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
