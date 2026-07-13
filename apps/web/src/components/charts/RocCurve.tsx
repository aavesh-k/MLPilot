import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RocCurve as RocCurveData } from "@/lib/api/client";
import { TooltipRows, fmt } from "./ChartTooltip";

const AXIS = "var(--chart-axis)";

function RocTip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TooltipRows
      rows={[
        { label: "False positive", value: fmt(p.fpr) },
        { label: "True positive", value: fmt(p.tpr), swatch: "var(--chart-1)" },
      ]}
    />
  );
}

/** Binary ROC curve with the chance-diagonal baseline. Single series → no legend. */
export default function RocCurve({ data }: { data: RocCurveData }) {
  const points = data.fpr.map((f, i) => ({ fpr: f, tpr: data.tpr[i] }));
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-medium text-muted-foreground">ROC curve</p>
        <span className="text-xs tabular-nums text-muted-foreground">
          AUC = {data.auc.toFixed(3)}
        </span>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 22, left: 0 }}>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="fpr"
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              stroke={AXIS}
              label={{
                value: "False positive rate",
                position: "insideBottom",
                offset: -12,
                fontSize: 11,
                fill: AXIS,
              }}
            />
            <YAxis
              type="number"
              dataKey="tpr"
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              stroke={AXIS}
              width={56}
              label={{
                value: "True positive rate",
                angle: -90,
                position: "insideLeft",
                offset: 16,
                fontSize: 11,
                fill: AXIS,
                style: { textAnchor: "middle" },
              }}
            />
            <ReferenceLine
              segment={[
                { x: 0, y: 0 },
                { x: 1, y: 1 },
              ]}
              stroke="var(--chart-ref)"
              strokeDasharray="4 4"
            />
            <Tooltip content={<RocTip />} />
            <Line
              type="monotone"
              dataKey="tpr"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
