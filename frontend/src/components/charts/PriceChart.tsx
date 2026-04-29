import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatUSD } from "@/lib/format";

interface PriceChartProps {
  data: { t: number; v: number }[];
  height?: number;
  color?: string;
}

export function PriceChart({ data, height = 360, color = "#7c5cff" }: PriceChartProps) {
  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f2638" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(t) =>
              new Date(t).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
            stroke="#5a6378"
            fontSize={11}
            tickMargin={8}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            stroke="#5a6378"
            fontSize={11}
            width={70}
            tickFormatter={(v) => formatUSD(v, { compact: true })}
            axisLine={false}
            tickLine={false}
            domain={["auto", "auto"]}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { t: number; v: number };
              return (
                <div className="rounded-lg border border-border bg-bg-card px-3 py-2 shadow-lg">
                  <div className="text-2xs uppercase tracking-wider text-ink-muted">
                    {new Date(p.t).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="text-sm font-semibold num text-ink mt-0.5">
                    {formatUSD(p.v)}
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fill="url(#priceFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
