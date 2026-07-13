import { CheckCircle2, Play, Train } from "lucide-react";
import { EmptyState } from "@/components/workspace/Section";
import { Section } from "@/components/workspace/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { DatasetResponse, RunResult } from "@/lib/api/client";

export default function TrainingSection({
  data,
  target,
  problemType,
  training,
  progress,
  steps,
  runError,
  result,
  onTargetChange,
  onTrain,
  onNavigate,
}: {
  data: DatasetResponse | null;
  target: string;
  problemType: string | null;
  training: boolean;
  progress: number;
  steps: { name: string; explanation: string; pct: number }[];
  runError: string | null;
  result: RunResult | null;
  onTargetChange: (t: string) => void;
  onTrain: () => void;
  onNavigate: (id: string) => void;
}) {
  if (!data) {
    return (
      <Section id="training" title="Training">
        <EmptyState
          icon={<Train className="size-5" />}
          title="Pick a target to train"
          hint="Upload a dataset first, then choose the column to predict and train a roster of models."
        />
      </Section>
    );
  }

  return (
    <Section
      id="training"
      title="Training"
      description="Choose the column to predict. We detect classification vs regression and train the full roster."
    >
      <div className="reveal space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground">Column to predict</span>
            <select
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              disabled={training}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition-[box-shadow,border-color] focus-visible:ring-2 focus-visible:ring-ring sm:w-64"
            >
              {data.columns.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <Button onClick={onTrain} disabled={training || !target}>
              {training ? (
                <>
                  <Spinner className="size-4" /> Training…
                </>
              ) : (
                <>
                  <Play className="size-4" /> Train models
                </>
              )}
            </Button>
            {problemType && (
              <Badge variant="secondary" className="capitalize">
                {problemType}
              </Badge>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          A cross-validated comparison of up to 9 models (classification) or 8 (regression),
          auto-selected preprocessing, and ranked by the metric that fits your task.
        </p>

        {(training || steps.length > 0) && (
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full bg-primary transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
                  training && progress < 100 && "progress-track"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <ul className="space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  <span>
                    <span className="font-medium capitalize">{s.name}</span>
                    <span className="text-muted-foreground">: {s.explanation}</span>
                  </span>
                </li>
              ))}
              {training && (
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" /> Working…
                </li>
              )}
            </ul>
          </div>
        )}

        {runError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {runError}
          </div>
        )}

        {result && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm">
              <span className="font-medium">{result.best_model}</span> won on{" "}
              <span className="font-medium">{result.primary_metric}</span>.
            </p>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => onNavigate("leaderboard")}>
              See the leaderboard
            </Button>
          </div>
        )}
      </div>
    </Section>
  );
}
