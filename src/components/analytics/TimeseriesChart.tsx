import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { TimeseriesPoint } from "@/lib/analytics";

export function TimeseriesChart({ data }: { data: TimeseriesPoint[] }) {
  return (
    <div style={{ height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="responsesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(226 64% 24%)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(226 64% 24%)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
            labelStyle={{ fontWeight: 600 }}
            formatter={(v: number) => [v, "Responses"]}
          />
          <Area type="monotone" dataKey="count" stroke="hsl(226 64% 24%)" strokeWidth={2.5} fill="url(#responsesFill)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
