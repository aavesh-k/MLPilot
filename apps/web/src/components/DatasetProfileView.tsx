import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Stat } from "@/components/workspace/Stat";
import { fmtNum, formatBytes } from "@/lib/format";
import type { ProfileResponse } from "@/lib/api/client";

const KIND_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  numeric: "default",
  categorical: "secondary",
  datetime: "outline",
  boolean: "secondary",
  constant: "outline",
};

function corrColor(v: number): string {
  const a = Math.pow(Math.min(Math.abs(v), 1), 0.6);
  if (v >= 0) return `color-mix(in srgb, var(--chart-pos) ${Math.round(a * 85)}%, transparent)`;
  return `color-mix(in srgb, var(--chart-neg) ${Math.round(a * 85)}%, transparent)`;
}

export default function DatasetProfileView({
  profile,
  target,
}: {
  profile: ProfileResponse;
  target?: string;
}) {
  const o = profile.overall;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Rows" value={o.n_rows.toLocaleString()} />
        <Stat label="Columns" value={String(o.n_cols)} />
        <Stat label="Memory" value={formatBytes(o.memory_bytes)} />
        <Stat label="Duplicate rows" value={o.duplicate_rows.toLocaleString()} />
        <Stat
          label="Missing cells"
          value={`${o.missing_pct}%`}
          tone={o.missing_pct > 0 ? "warn" : "default"}
        />
        <Stat label="Constant cols" value={String(o.constant_cols)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="default">{o.numeric_cols} numeric</Badge>
        <Badge variant="secondary">{o.categorical_cols} categorical</Badge>
        {o.datetime_cols > 0 && <Badge variant="outline">{o.datetime_cols} datetime</Badge>}
      </div>

      <div className="rounded-xl border bg-primary/[0.04] p-4 text-sm shadow-sm">
        <span className="text-muted-foreground">Suggested target: </span>
        <span className="font-medium">{profile.suggested_target}</span>
        <Badge variant="secondary" className="ml-2 capitalize">
          {profile.suggested_task}
        </Badge>
        <p className="mt-1.5 text-xs text-muted-foreground text-pretty">
          {profile.suggested_reason}
        </p>
      </div>

      {profile.class_balance.length > 0 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="mb-3 text-sm font-medium">
            Class balance{" "}
            <span className="text-muted-foreground font-normal">\u00B7 {profile.suggested_target}</span>
          </p>
          <div className="space-y-2.5">
            {profile.class_balance.map((cb) => (
              <div key={cb.label} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{cb.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {cb.count.toLocaleString()} ({cb.pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-500 ease-[var(--ease-out)]"
                    style={{ width: `${cb.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3.5">
          <p className="text-sm font-medium">Columns</p>
        </div>
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
                <TableRow key={c.name} className={c.name === target ? "bg-primary/[0.04]" : ""}>
                  <TableCell className="font-medium">
                    {c.name}
                    {c.name === target && (
                      <span className="ml-2 text-xs font-medium text-primary">target</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={KIND_VARIANT[c.kind] ?? "outline"}>{c.kind}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {c.nulls > 0 ? `${c.nulls} (${c.null_pct}%)` : "\u2014"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {c.unique.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmtNum(c.mean)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmtNum(c.min)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {fmtNum(c.max)}
                  </TableCell>
                  <TableCell className="max-w-44 truncate text-muted-foreground" title={c.top ?? ""}>
                    {c.top ?? "\u2014"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {profile.correlation_labels.length >= 2 && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <p className="mb-1 text-sm font-medium">Numeric correlation</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Pearson correlation between numeric columns.
          </p>
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
                        style={{
                          backgroundColor: corrColor(v),
                          color: Math.abs(v) > 0.55 ? "#ffffff" : "var(--foreground)",
                        }}
                        title={`${profile.correlation_labels[i]} \u00D7 ${profile.correlation_labels[j]} = ${v.toFixed(2)}`}
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
              <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: "var(--chart-neg)" }} />
              \u22121
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-[2px] border border-border" />0
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: "var(--chart-pos)" }} />
              +1
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
