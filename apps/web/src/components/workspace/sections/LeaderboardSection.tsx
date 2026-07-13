import { Lightbulb, Trophy } from "lucide-react";
import { EmptyState } from "@/components/workspace/Section";
import { Section } from "@/components/workspace/Section";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RunResult } from "@/lib/api/client";

export default function LeaderboardSection({ result }: { result: RunResult | null }) {
  if (!result) {
    return (
      <Section id="leaderboard" title="Leaderboard">
        <EmptyState
          icon={<Trophy className="size-5" />}
          title="No results yet"
          hint="Train a roster of models and they'll be ranked here by the metric that fits your task."
        />
      </Section>
    );
  }

  const metricLabel = result.primary_metric;
  const maxImp = Math.max(...result.feature_importance.map((f) => Math.abs(f.importance)), 1e-9);

  return (
    <Section
      id="leaderboard"
      title="Leaderboard"
      description={`Every candidate ranked by ${metricLabel} (higher is better).`}
    >
      <div className="reveal space-y-6">
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">{metricLabel}</TableHead>
                <TableHead className="text-right">CV score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.models.map((m) => (
                <TableRow key={m.key} className={m.is_best ? "bg-primary/[0.06]" : ""}>
                  <TableCell className={cn("font-medium tabular-nums", m.is_best && "text-primary")}>
                    {m.rank}
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      {m.name}
                      {m.is_best && <Badge variant="default">best</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatValue(m.metrics[metricLabel] ?? m.primary_score)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {m.cv_mean.toFixed(3)}
                    <span className="text-muted-foreground/60"> \u00B1 {m.cv_std.toFixed(3)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {result.feature_importance.length > 0 && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="mb-4 text-sm font-medium">
              Top drivers{" "}
              <span className="text-muted-foreground font-normal">\u00B7 permutation importance</span>
            </p>
            <ul className="stagger space-y-3">
              {result.feature_importance.map((f) => (
                <li key={f.feature} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{f.feature}</span>
                    <span className="tabular-nums text-muted-foreground">{f.importance.toFixed(4)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500 ease-[var(--ease-out)]"
                      style={{ width: `${Math.max(2, (Math.abs(f.importance) / maxImp) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.insights.length > 0 && (
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
              <Lightbulb className="size-4 text-warning" /> Insights
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-foreground/30">
              {result.insights.map((ins, i) => (
                <li key={i} className="text-pretty">
                  {ins}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}
