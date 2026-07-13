import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProfile, type ProfileResponse } from "@/lib/api/client";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(3);
}

const KIND_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  numeric: "default",
  categorical: "secondary",
  datetime: "outline",
  boolean: "secondary",
  constant: "outline",
};

// Blue (negative) → neutral → red (positive) for a correlation cell.
// A gamma curve (a^0.6) lifts low-magnitude correlations so faint values stay
// visible, while zero still maps to fully transparent (neutral).
function corrColor(v: number): string {
  const a = Math.pow(Math.min(Math.abs(v), 1), 0.6);
  if (v >= 0) return `rgba(220, 38, 38, ${a * 0.85})`;
  return `rgba(37, 99, 235, ${a * 0.85})`;
}

export default function DatasetProfile({ datasetId }: { datasetId: string }) {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setError(null);
    const controller = new AbortController();
    getProfile(datasetId, controller.signal)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) => {
        if (!cancelled && err?.name !== "AbortError") {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [datasetId]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Could not profile dataset: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data profile</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Profiling your dataset…
        </CardContent>
      </Card>
    );
  }

  const o = profile.overall;

  return (
    <div className="space-y-4">
      {/* Overall quality tiles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Rows" value={o.n_rows.toLocaleString()} />
            <Stat label="Columns" value={String(o.n_cols)} />
            <Stat label="Memory" value={formatBytes(o.memory_bytes)} />
            <Stat label="Duplicate rows" value={o.duplicate_rows.toLocaleString()} />
            <Stat label="Missing cells" value={`${o.missing_pct}%`} />
            <Stat label="Constant cols" value={String(o.constant_cols)} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="default">{o.numeric_cols} numeric</Badge>
            <Badge variant="secondary">{o.categorical_cols} categorical</Badge>
            {o.datetime_cols > 0 && <Badge variant="outline">{o.datetime_cols} datetime</Badge>}
          </div>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">Suggested target: </span>
            <span className="font-medium">{profile.suggested_target}</span>
            <Badge variant="secondary" className="ml-2 capitalize">
              {profile.suggested_task}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              It {profile.suggested_reason}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Class balance (classification targets only) */}
      {profile.class_balance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Class balance · {profile.suggested_target}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {profile.class_balance.map((cb) => (
              <div key={cb.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{cb.label}</span>
                  <span className="text-muted-foreground">
                    {cb.count.toLocaleString()} ({cb.pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${cb.pct}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Per-column stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Columns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead className="text-right">Missing</TableHead>
                  <TableHead className="text-right">Unique</TableHead>
                  <TableHead className="text-right">Mean</TableHead>
                  <TableHead className="text-right">Min</TableHead>
                  <TableHead className="text-right">Max</TableHead>
                  <TableHead>Top</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profile.columns.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant={KIND_VARIANT[c.kind] ?? "outline"}>{c.kind}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {c.nulls > 0 ? `${c.nulls} (${c.null_pct}%)` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {c.unique.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmtNum(c.mean)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmtNum(c.min)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {fmtNum(c.max)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.top ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Correlation heatmap */}
      {profile.correlation_labels.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Numeric correlation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-0.5 text-xs">
                <thead>
                  <tr>
                    <th className="p-1" />
                    {profile.correlation_labels.map((l) => (
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
                  {profile.correlation.map((row, i) => (
                    <tr key={profile.correlation_labels[i]}>
                      <td
                        className="max-w-16 truncate p-1 pr-2 text-right font-medium text-muted-foreground"
                        title={profile.correlation_labels[i]}
                      >
                        {profile.correlation_labels[i]}
                      </td>
                      {row.map((v, j) => (
                        <td
                          key={j}
                          className="h-8 w-10 rounded text-center font-medium tabular-nums"
                          style={{ backgroundColor: corrColor(v), color: "var(--foreground)" }}
                          title={`${profile.correlation_labels[i]} × ${profile.correlation_labels[j]} = ${v.toFixed(2)}`}
                        >
                          {v.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold" title={value}>
        {value}
      </p>
    </div>
  );
}
