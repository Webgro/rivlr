"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const NEUTRAL_500 = "#737373";
const GRID_STROKE = "rgba(127,127,127,0.28)";

interface Series {
  id: string;
  title: string;
  colour: string;
  data: { t: number; price: number }[];
}

/**
 * Multi-line price comparison chart. Recharts wants a single dataset with
 * keys per line, so we pivot the per-series arrays into one timeline by
 * timestamp, with each series' price under series.id.
 */
export function CompareChart({
  series,
  currencySymbol,
}: {
  series: Series[];
  currencySymbol: string;
}) {
  // Build a unified timeline.
  const times = new Set<number>();
  for (const s of series) for (const p of s.data) times.add(p.t);
  const sortedTimes = Array.from(times).sort((a, b) => a - b);

  // For each timestamp, take the most recent observation <= t per series
  // (forward-fill). This keeps the chart smooth even when crawls are offset.
  const chartData = sortedTimes.map((t) => {
    const row: Record<string, number | null> = { t };
    for (const s of series) {
      const before = s.data.filter((d) => d.t <= t);
      row[s.id] = before.length > 0 ? before[before.length - 1].price : null;
    }
    return row;
  });

  if (chartData.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-muted">
        No price history yet for these products.
      </div>
    );
  }

  return (
    <div className="h-96">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 12, bottom: 4, left: 8 }}
        >
          <CartesianGrid stroke={GRID_STROKE} strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tickFormatter={fmtDate}
            stroke={NEUTRAL_500}
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={NEUTRAL_500}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${currencySymbol}${v}`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null;
              return (
                <div className="rounded border border-default bg-surface px-3 py-2 text-xs shadow-lg">
                  <div className="font-mono text-muted mb-1">
                    {new Date(label as number).toLocaleString()}
                  </div>
                  {payload.map((p) => {
                    const s = series.find((s) => s.id === p.dataKey);
                    if (!s) return null;
                    return (
                      <div
                        key={p.dataKey as string}
                        className="flex items-center gap-2 font-mono"
                      >
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: s.colour }}
                        />
                        <span className="truncate max-w-[200px]">
                          {s.title}
                        </span>
                        <span className="ml-auto">
                          {currencySymbol}
                          {Number(p.value).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
            formatter={(_, entry) => {
              const s = series.find((s) => s.id === entry.dataKey);
              const label = typeof s?.title === "string" ? s.title : String(entry.dataKey);
              return (
                <span style={{ color: "var(--foreground)" }}>{label}</span>
              );
            }}
          />
          {series.map((s) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              stroke={s.colour}
              strokeWidth={1.75}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function fmtDate(t: number) {
  const d = new Date(t);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
