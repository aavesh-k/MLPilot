import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadRunArtifact, type RunResult } from "@/lib/api/client";

export default function ReportsList() {
  const [runs, setRuns] = useState<RunResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/runs")
      .then((res) => {
        if (!res.ok) throw new Error(`failed: ${res.status}`);
        return res.json();
      })
      .then((data: RunResult[]) => {
        if (!cancelled) setRuns(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (runs === null && !error) {
    return <p className="text-sm text-muted-foreground">Loading reports…</p>;
  }
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        Could not load reports: {error}
      </div>
    );
  }
  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-medium">No reports yet</p>
          <p className="text-sm text-muted-foreground">
            Complete a training run from the upload page and it will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((r) => (
        <Card key={r.run_id}>
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{r.target}</span>
                <Badge variant="secondary" className="capitalize">{r.problem_type}</Badge>
                <Badge variant="outline">{r.best_model}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">{r.primary_metric}</TableHead>
                  <TableHead className="text-right">CV score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.models.map((m) => (
                  <TableRow key={m.key} className={m.is_best ? "bg-primary/10" : ""}>
                    <TableCell className="font-medium">{m.rank}</TableCell>
                    <TableCell className="font-medium">
                      {m.name}
                      {m.is_best && <Badge variant="secondary" className="ml-2">best</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {(m.metrics[r.primary_metric] ?? m.primary_score).toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {m.cv_mean.toFixed(3)} ± {m.cv_std.toFixed(3)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap gap-2 border-t border-border pt-3">
              <a href={downloadRunArtifact(r.run_id, "model")} className={dlClass()}>Model</a>
              <a href={downloadRunArtifact(r.run_id, "predictions")} className={dlClass()}>Predictions</a>
              <a href={downloadRunArtifact(r.run_id, "report")} className={dlClass()}>Report</a>
              {r.artifacts?.pdf && (
                <a href={downloadRunArtifact(r.run_id, "pdf")} className={dlClass()}>PDF</a>
              )}
              {r.artifacts?.cleaned && (
                <a href={downloadRunArtifact(r.run_id, "cleaned")} className={dlClass()}>Cleaned CSV</a>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function dlClass() {
  return "inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground";
}
