import { ArrowRight, CheckCircle2, Circle, Trophy } from "lucide-react";
import { Section } from "@/components/workspace/Section";
import { Stat } from "@/components/workspace/Stat";
import Dropzone from "@/components/workspace/Dropzone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatBytes, formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DatasetResponse, ProfileResponse, RunResult } from "@/lib/api/client";

type Stage = "done" | "active" | "todo";

function PipelineStatus({
  data,
  hasResult,
  training,
}: {
  data: DatasetResponse | null;
  hasResult: boolean;
  training: boolean;
}) {
  const steps: { label: string; stage: Stage }[] = [
    { label: "Upload", stage: data ? "done" : "active" },
    { label: "Profile", stage: data ? "done" : "todo" },
    {
      label: "Train",
      stage: hasResult ? "done" : training ? "active" : data ? "active" : "todo",
    },
    { label: "Results", stage: hasResult ? "done" : "todo" },
  ];

  return (
    <ol className="flex items-center gap-1 text-xs">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-1">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2 py-1 font-medium",
              s.stage === "done" && "text-emerald-600 dark:text-emerald-400",
              s.stage === "active" && "bg-accent text-foreground",
              s.stage === "todo" && "text-muted-foreground"
            )}
          >
            {s.stage === "done" ? (
              <CheckCircle2 className="size-3.5" />
            ) : (
              <Circle className={cn("size-3.5", s.stage === "active" && "animate-pulse")} />
            )}
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className="h-px w-4 bg-border" aria-hidden />
          )}
        </li>
      ))}
    </ol>
  );
}

export default function OverviewSection({
  data,
  profile,
  result,
  uploading,
  training,
  onFile,
  onNavigate,
}: {
  data: DatasetResponse | null;
  profile: ProfileResponse | null;
  result: RunResult | null;
  uploading: boolean;
  training: boolean;
  onFile: (file: File) => void;
  onNavigate: (id: string) => void;
}) {
  if (!data) {
    return (
      <Section
        id="overview"
        title="Start a run"
        description="Upload a CSV and AutoML Studio profiles it, cleans it, trains and compares a roster of models, then explains and exports the best one — no pipeline code."
      >
        <Dropzone onFile={onFile} loading={uploading} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { n: "01", t: "Profile & clean", d: "Types, missingness, correlations, IQR outlier capping." },
            { n: "02", t: "Train & compare", d: "Up to 9 models ranked by cross-validated score." },
            { n: "03", t: "Explain & export", d: "Charts, plain-language insights, model + PDF report." },
          ].map((s) => (
            <div key={s.n} className="rounded-lg border bg-card p-4">
              <p className="text-xs font-medium text-muted-foreground">{s.n}</p>
              <p className="mt-1 font-medium">{s.t}</p>
              <p className="mt-0.5 text-sm text-muted-foreground text-pretty">{s.d}</p>
            </div>
          ))}
        </div>
      </Section>
    );
  }

  const task = result?.problem_type ?? profile?.suggested_task;
  const primaryScore = result
    ? formatValue(
        result.models.find((m) => m.is_best)?.metrics[result.primary_metric] ??
          result.models.find((m) => m.is_best)?.primary_score
      )
    : null;

  return (
    <Section
      id="overview"
      title="Overview"
      description="A snapshot of your dataset and the current run."
      aside={<PipelineStatus data={data} hasResult={!!result} training={training} />}
    >
      <div className="reveal space-y-4">
        {result && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-gradient-to-br from-primary/[0.07] to-transparent p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Trophy className="size-5" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">Best model</p>
                <p className="text-lg font-semibold">{result.best_model}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{result.primary_metric}</p>
                <p className="text-lg font-semibold tabular-nums">{primaryScore}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onNavigate("leaderboard")}>
                Leaderboard <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Dataset" value={data.filename} />
          <Stat label="Size" value={formatBytes(data.size_bytes)} />
          <Stat label="Rows" value={data.n_rows.toLocaleString()} />
          <Stat label="Columns" value={String(data.n_cols)} />
          <Stat
            label="Target"
            value={result?.target ?? profile?.suggested_target ?? "—"}
            tone="accent"
          />
          <Stat label="Task" value={task ? task[0].toUpperCase() + task.slice(1) : "—"} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!result && (
            <Button size="sm" onClick={() => onNavigate("training")}>
              Choose target & train <ArrowRight className="size-4" />
            </Button>
          )}
          {result && (
            <Button size="sm" onClick={() => onNavigate("visualizations")}>
              View visualizations <ArrowRight className="size-4" />
            </Button>
          )}
          {task && (
            <Badge variant="secondary" className="capitalize">
              {task}
            </Badge>
          )}
          <div className="ml-auto w-full sm:w-64">
            <Dropzone onFile={onFile} loading={uploading} compact />
          </div>
        </div>
      </div>
    </Section>
  );
}
