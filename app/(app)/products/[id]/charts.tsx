"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";

interface PricePoint {
  t: number; // unix ms
  price: number;
}

interface StockPoint {
  t: number; // unix ms
  available: number; // 0 or 1
  quantity: number | null;
}

const SIGNAL = "#FF3B30";
const NEUTRAL_500 = "#737373";
const GREEN = "#22c55e";
// Theme-aware: SVG inherits via the parent .text-foreground class, so these
// render correctly in both light and dark mode.
const FOREGROUND = "currentColor";
const GRID_STROKE = "rgba(127,127,127,0.28)";

function fmtDate(t: number) {
  const d = new Date(t);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function PriceChart({
  data,
  currencySymbol,
}: {
  data: PricePoint[];
  currencySymbol: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-neutral-800 text-sm text-neutral-500">
        No price history yet — first crawl is the next reading.
      </div>
    );
  }

  return (
    <div className="h-64 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
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
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p = payload[0].payload as PricePoint;
              return (
                <div className="rounded border border-neutral-700 bg-ink px-3 py-2 text-xs">
                  <div className="font-mono text-paper">
                    {currencySymbol}
                    {p.price.toFixed(2)}
                  </div>
                  <div className="font-mono text-neutral-500">
                    {new Date(p.t).toLocaleString()}
                  </div>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke={SIGNAL}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StockChart({
  data,
  hasQuantity,
}: {
  data: StockPoint[];
  hasQuantity: boolean;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-neutral-800 text-sm text-neutral-500">
        No stock history yet.
      </div>
    );
  }

  if (hasQuantity) {
    return (
      <div className="h-64 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
            <defs>
              <linearGradient id="qtyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GREEN} stopOpacity={0.4} />
                <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
              </linearGradient>
            </defs>
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
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const p = payload[0].payload as StockPoint;
                return (
                  <div className="rounded border border-neutral-700 bg-ink px-3 py-2 text-xs">
                    <div className="font-mono text-paper">
                      {p.quantity ?? "—"} in stock
                    </div>
                    <div className="font-mono text-neutral-500">
                      {new Date(p.t).toLocaleString()}
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="stepAfter"
              dataKey="quantity"
              stroke={GREEN}
              strokeWidth={1.75}
              fill="url(#qtyGrad)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // No quantities — just plot in/out as a step line at 0/1.
  return (
    <div className="h-40 rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
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
            domain={[0, 1]}
            ticks={[0, 1]}
            tickFormatter={(v) => (v === 1 ? "In" : "Out")}
            width={36}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const p = payload[0].payload as StockPoint;
              return (
                <div className="rounded border border-neutral-700 bg-ink px-3 py-2 text-xs">
                  <div className="font-mono text-paper">
                    {p.available ? "In stock" : "Out of stock"}
                  </div>
                  <div className="font-mono text-neutral-500">
                    {new Date(p.t).toLocaleString()}
                  </div>
                </div>
              );
            }}
          />
          <ReferenceLine y={0.5} stroke={GRID_STROKE} strokeDasharray="2 4" />
          <Line
            type="stepAfter"
            dataKey="available"
            stroke={FOREGROUND}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
