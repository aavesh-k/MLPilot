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
import type { ResidualPoint } from "@/lib/api/client";
import { TooltipRows, fmt } from "./ChartTooltip";

const AXIS = "var(--chart-axis)";

function ResidualTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TooltipRows
      rows={[
        { label: "Predicted", value: fmt(p.predicted) },
        { label: "Residual", value: fmt(p.residual), swatch: "var(--chart-2)" },
      ]}
    />
  );
}

/** Residuals vs. predicted; the y = 0 line is the no-error reference. */
export default function ResidualPlot({ data }: { data: ResidualPoint[] }) {
  const preds = data.map((d) => d.predicted);
  const min = Math.min(...preds);
  const max = Math.max(...preds);
  const pad = (max - min) * 0.05 || 1;

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        Residuals vs. predicted
      </p>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <ScatterChart margin={{ top: 8, right: 16, bottom: 22, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="predicted"
              name="Predicted"
              domain={[min - pad, max + pad]}
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              stroke={AXIS}
              tickFormatter={(v) => fmt(v, 2)}
              label={{
                value: "Predicted",
                position: "insideBottom",
                offset: -12,
                fontSize: 11,
                fill: AXIS,
              }}
            />
            <YAxis
              type="number"
              dataKey="residual"
              name="Residual"
              width={56}
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              stroke={AXIS}
              tickFormatter={(v) => fmt(v, 2)}
              label={{
                value: "Residual",
                angle: -90,
                position: "insideLeft",
                offset: 16,
                fontSize: 11,
                fill: AXIS,
                style: { textAnchor: "middle" },
              }}
            />
            <ZAxis range={[24, 24]} />
            <ReferenceLine y={0} stroke="var(--chart-ref)" strokeDasharray="4 4" />
            <Tooltip content={<ResidualTip />} cursor={{ strokeDasharray: "3 3" }} />
            <Scatter
              data={data}
              fill="var(--chart-2)"
              fillOpacity={0.55}
              isAnimationActive={false}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
