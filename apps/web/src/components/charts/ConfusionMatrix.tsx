import type { ConfusionMatrix as ConfusionMatrixData } from "@/lib/api/client";

/**
 * Confusion matrix as a heatmap grid. Magnitude → one sequential hue (blue),
 * more-is-darker; rows are the true class, columns the predicted class.
 */
export default function ConfusionMatrix({ data }: { data: ConfusionMatrixData }) {
  const { labels, matrix } = data;
  const max = Math.max(1, ...matrix.flat());

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">Confusion matrix</p>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-xs">
          <thead>
            <tr>
              <th className="p-1" />
              <th
                className="p-1 text-center font-medium text-muted-foreground"
                colSpan={labels.length}
              >
                Predicted
              </th>
            </tr>
            <tr>
              <th className="p-1 text-right font-medium text-muted-foreground">True ↓</th>
              {labels.map((l) => (
                <th
                  key={l}
                  className="max-w-20 truncate p-1 text-center font-medium text-muted-foreground"
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
                {row.map((v, j) => {
                  const a = v / max;
                  return (
                    <td
                      key={j}
                      className="h-11 w-14 rounded text-center font-semibold tabular-nums"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--chart-1) ${Math.round(
                          a * 100
                        )}%, transparent)`,
                        color: a > 0.55 ? "#ffffff" : "var(--foreground)",
                        outline: i === j ? "1.5px solid var(--chart-1)" : "none",
                        outlineOffset: "-1.5px",
                      }}
                      title={`True ${labels[i]} → Predicted ${labels[j]}: ${v}`}
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Diagonal cells (outlined) are correct predictions.
      </p>
    </div>
  );
}
