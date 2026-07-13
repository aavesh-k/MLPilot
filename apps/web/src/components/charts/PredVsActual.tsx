import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { PredPoint } from "@/lib/api/client";
import { TooltipRows, fmt } from "./ChartTooltip";

const AXIS = "var(--chart-axis)";

function PredTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TooltipRows
      rows={[
        { label: "Actual", value: fmt(p.actual) },
        { label: "Predicted", value: fmt(p.predicted), swatch: "var(--chart-1)" },
      ]}
    />
  );
}

/** Predicted vs. actual scatter; the dashed y = x line is the perfect-fit reference. */
export default function PredVsActual({ data }: { data: PredPoint[] }) {
  const vals = data.flatMap((d) => [d.actual, d.predicted]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.05 || 1;
  const domain: [number, number] = [min - pad, max + pad];

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        Predicted vs. actual{" "}
        <span className="text-xs font-normal">({data.length} test points)</span>
      </p>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 22, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="actual"
              name="Actual"
              domain={domain}
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              stroke={AXIS}
              tickFormatter={(v) => fmt(v, 2)}
              label={{
                value: "Actual",
                position: "insideBottom",
                offset: -12,
                fontSize: 11,
                fill: AXIS,
              }}
            />
            <YAxis
              type="number"
              dataKey="predicted"
              name="Predicted"
              domain={domain}
              width={56}
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              stroke={AXIS}
              tickFormatter={(v) => fmt(v, 2)}
              label={{
                value: "Predicted",
                angle: -90,
                position: "insideLeft",
                offset: 16,
                fontSize: 11,
                fill: AXIS,
                style: { textAnchor: "middle" },
              }}
            />
            <ZAxis range={[24, 24]} />
            <ReferenceLine
              segment={[
                { x: domain[0], y: domain[0] },
                { x: domain[1], y: domain[1] },
              ]}
              stroke="var(--chart-ref)"
              strokeDasharray="4 4"
            />
            <Tooltip content={<PredTip />} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter
              data={data}
              fill="var(--chart-1)"
              fillOpacity={0.55}
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
