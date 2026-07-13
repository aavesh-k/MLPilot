import type { Correlation } from "@/lib/api/client";

// Diverging: warm pole for positive, cool pole for negative, neutral at zero.
// Uses the dataviz diverging pair via CSS custom properties.
function corrColor(v: number): string {
  const a = Math.min(Math.abs(v), 1);
  const pole = v >= 0 ? "var(--chart-pos)" : "var(--chart-neg)";
  return `color-mix(in srgb, ${pole} ${Math.round(a * 85)}%, transparent)`;
}

/** Numeric Pearson correlation heatmap (shared with the M2 profile). */
export default function CorrelationHeatmap({ data }: { data: Correlation }) {
  const { labels, matrix } = data;
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">Numeric correlation</p>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-xs">
          <thead>
            <tr>
              <th className="p-1" />
              {labels.map((l) => (
                <th
                  key={l}
                  className="max-w-16 truncate p-1 text-left font-medium text-muted-foreground"
                  title={l}
                >
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={labels[i]}>
                <td
                  className="max-w-24 truncate p-1 pr-2 text-right font-medium text-muted-foreground"
                  title={labels[i]}
                >
                  {labels[i]}
                </td>
                {row.map((v, j) => (
                  <td
                    key={j}
                    className="h-8 w-12 rounded text-center font-medium tabular-nums"
                    style={{
                      backgroundColor: corrColor(v),
                      color: "var(--foreground)",
                    }}
                    title={`${labels[i]} × ${labels[j]} = ${v.toFixed(2)}`}
                  >
                    {v.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ backgroundColor: "var(--chart-neg)" }}
          />
          −1
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px] border border-border" />0
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ backgroundColor: "var(--chart-pos)" }}
          />
          +1
        </span>
      </div>
    </div>
  );
}
