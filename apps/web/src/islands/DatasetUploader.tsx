import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import DatasetProfile from "@/components/DatasetProfile";
import EvaluationCharts from "@/components/charts/EvaluationCharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createRun,
  downloadRunArtifact,
  streamRun,
  uploadDataset,
  type CleaningSummary,
  type DatasetResponse,
  type RunResult,
} from "@/lib/api/client";

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

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(4);
  return String(v);
}

export default function DatasetUploader() {
  const [data, setData] = useState<DatasetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Milestone 03: target selection.
  const [target, setTarget] = useState<string>("");
  const [problemType, setProblemType] = useState<string | null>(null);

  // Milestone 04/05: training + results.
  const [training, setTraining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<{ name: string; explanation: string; pct: number }[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please choose a .csv file.");
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    setResult(null);
    setProblemType(null);
    setSteps([]);
    setProgress(0);
    try {
      const ds = await uploadDataset(file);
      setData(ds);
      // Default the target to the last column — a common convention.
      setTarget(ds.columns[ds.columns.length - 1]?.name ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function train() {
    if (!data || !target) return;
    setTraining(true);
    setProgress(0);
    setSteps([]);
    setResult(null);
    setRunError(null);
    setProblemType(null);

    let source: EventSource | null = null;
    try {
      const { run_id } = await createRun(data.id, target);
      runIdRef.current = run_id;
      source = streamRun(run_id, {
        onEvent: (ev) => {
          if (ev.type === "step") {
            setProgress(ev.pct);
            setSteps((prev) => [...prev, { name: ev.name, explanation: ev.explanation, pct: ev.pct }]);
          } else if (ev.type === "result") {
            setResult(ev.result);
            setProblemType(ev.result.problem_type);
          } else if (ev.type === "done") {
            source?.close();
            setTraining(false);
          } else if (ev.type === "error") {
            setRunError(ev.message);
            source?.close();
            setTraining(false);
          }
        },
        onError: (err) => {
          if (training && !result) {
            setRunError(err instanceof Error ? err.message : "Training stream lost.");
          }
          source?.close();
          setTraining(false);
        },
      });
    } catch (err) {
      setRunError(err instanceof Error ? err.message : String(err));
      setTraining(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          dragActive
            ? "border-primary bg-accent/50"
            : "border-muted-foreground/30 hover:bg-accent/30"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <p className="text-sm font-medium">
          {loading ? "Uploading & profiling…" : "Drag & drop a CSV here"}
        </p>
        <p className="text-xs text-muted-foreground">
          or click to browse · .csv up to ~100 MB
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="File" value={data.filename} />
            <Stat label="Size" value={formatBytes(data.size_bytes)} />
            <Stat label="Rows" value={data.n_rows.toLocaleString()} />
            <Stat label="Columns" value={String(data.n_cols)} />
          </div>

          {/* Milestone 02 — Data profile */}
          <DatasetProfile datasetId={data.id} />

          {/* Milestone 03 — Pick a target */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pick a target</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted-foreground">Column to predict</span>
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    disabled={training}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                  >
                    {data.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button onClick={train} disabled={training || !target}>
                  {training ? (
                    <>
                      <Spinner className="mr-2" /> Training…
                    </>
                  ) : (
                    "Train models"
                  )}
                </Button>
                {problemType && (
                  <Badge variant="secondary" className="capitalize">
                    {problemType}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                We automatically detect whether this is a classification or
                regression problem, then train and compare several models.
              </p>
            </CardContent>
          </Card>

          {runError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {runError}
            </div>
          )}

          {(training || steps.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {result ? "Training complete" : "Training models"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <ul className="space-y-2">
                  {steps.map((s, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="mt-0.5 text-primary">✓</span>
                      <span>
                        <span className="font-medium capitalize">{s.name}</span>: {s.explanation}
                      </span>
                    </li>
                  ))}
                  {training && (
                    <li className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner /> Working…
                    </li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          {result && <ResultsPanel result={result} runId={runIdRef.current} />}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Columns & types</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Column</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Missing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.columns.map((c) => (
                    <TableRow key={c.name} className={c.name === target ? "bg-accent/40" : ""}>
                      <TableCell className="font-medium">
                        {c.name}
                        {c.name === target && (
                          <span className="ml-2 text-xs text-primary">(target)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.dtype}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{c.nulls}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview (first {data.preview.length} rows)</CardTitle>
            </CardHeader>
            <CardContent>
              {data.preview.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(data.preview[0]).map((k) => (
                        <TableHead key={k}>{k}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.preview.map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).map((v, j) => (
                          <TableCell key={j} className="whitespace-nowrap">
                            {formatValue(v)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">No rows to preview.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ResultsPanel({ result, runId }: { result: RunResult; runId: string | null }) {
  const maxImp = Math.max(...result.feature_importance.map((f) => Math.abs(f.importance)), 1e-9);
  const metricLabel = result.primary_metric;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">
            {result.problem_type === "classification" ? "Classification" : "Regression"} ·{" "}
            <span className="text-primary">{result.best_model}</span> wins
          </CardTitle>
          <Badge variant="default">Best: {result.best_model}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Model comparison */}
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">
              Model comparison (ranked by {metricLabel})
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">{metricLabel}</TableHead>
                  <TableHead className="text-right">CV score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.models.map((m) => (
                  <TableRow key={m.key} className={m.is_best ? "bg-primary/10" : ""}>
                    <TableCell className="font-medium">{m.rank}</TableCell>
                    <TableCell className="font-medium">
                      {m.name}
                      {m.is_best && (
                        <Badge variant="secondary" className="ml-2">best</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatValue(m.metrics[metricLabel] ?? m.primary_score)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {m.cv_mean.toFixed(3)} ± {m.cv_std.toFixed(3)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Feature importance */}
          {result.feature_importance.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Top drivers (permutation importance)
              </p>
              <ul className="space-y-1.5">
                {result.feature_importance.map((f) => (
                  <li key={f.feature} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{f.feature}</span>
                      <span className="text-muted-foreground">{f.importance.toFixed(4)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.max(2, (Math.abs(f.importance) / maxImp) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cleaning summary */}
          {result.cleaning && <CleaningSummaryCard cleaning={result.cleaning} />}

          {/* Insights */}
          <div>
            <p className="mb-2 text-sm font-medium text-muted-foreground">Insights</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {result.insights.map((ins, i) => (
                <li key={i}>{ins}</li>
              ))}
            </ul>
          </div>

          {/* Export */}
          {runId && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <a href={downloadRunArtifact(runId, "model")} className={buttonClass()}>
                Download model
              </a>
              <a href={downloadRunArtifact(runId, "predictions")} className={buttonClass()}>
                Download predictions
              </a>
              <a href={downloadRunArtifact(runId, "report")} className={buttonClass()}>
                Download report
              </a>
              {result.artifacts?.pdf && (
                <a href={downloadRunArtifact(runId, "pdf")} className={buttonClass()}>
                  Download PDF
                </a>
              )}
              <a href={downloadRunArtifact(runId, "cleaned")} className={buttonClass()}>
                Download cleaned CSV
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Milestone 05 — Evaluation charts */}
      <EvaluationCharts
        evaluation={result.evaluation}
        problemType={result.problem_type}
      />
    </div>
  );
}

function CleaningSummaryCard({ cleaning }: { cleaning: CleaningSummary }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">Cleaning summary</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Rows"
          value={`${cleaning.rows_before.toLocaleString()} → ${cleaning.rows_after.toLocaleString()}`}
        />
        <Stat label="Duplicate rows dropped" value={cleaning.dropped_dupes.toLocaleString()} />
        <Stat label="Columns dropped" value={String(cleaning.dropped_cols.length)} />
        <Stat label="Columns capped" value={String(cleaning.capped_cols.length)} />
      </div>

      {cleaning.dropped_cols.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium">Dropped (constant/empty):</span>{" "}
          {cleaning.dropped_cols.join(", ")}
        </p>
      )}

      {cleaning.capped_cols.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium">Outliers capped (IQR):</span>{" "}
          {cleaning.capped_cols.map((c) => `${c.col} (${c.count})`).join(", ")}
        </p>
      )}

      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-medium">Imputation:</span> numeric →{" "}
        {cleaning.impute_strategy.numeric ?? "—"}, categorical →{" "}
        {cleaning.impute_strategy.categorical ?? "—"}
      </p>
    </div>
  );
}

function buttonClass() {
  return "inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground";
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
