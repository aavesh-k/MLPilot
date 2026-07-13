import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ClassCount } from "@/lib/api/client";
import { TooltipRows, fmt } from "./ChartTooltip";

const AXIS = "var(--chart-axis)";

function ClassTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TooltipRows
      rows={[{ label: String(p.label), value: fmt(p.count), swatch: "var(--chart-1)" }]}
    />
  );
}

/** Actual class distribution in the hold-out set. Magnitude → one sequential hue. */
export default function ClassDistribution({ data }: { data: ClassCount[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        Test-set class distribution
      </p>
      <div className="h-56 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              stroke={AXIS}
            />
            <YAxis
              allowDecimals={false}
              width={36}
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              stroke={AXIS}
            />
            <Tooltip content={<ClassTip />} cursor={{ fill: "var(--chart-grid)", opacity: 0.4 }} />
            <Bar
              dataKey="count"
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
