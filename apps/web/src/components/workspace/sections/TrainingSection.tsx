import { useEffect, useRef } from "react";
import { CheckCircle2, Play, Train } from "lucide-react";
import gsap from "gsap";
import { EmptyState } from "@/components/workspace/Section";
import { Section } from "@/components/workspace/Section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { prefersReduced, EASES, DURS, safeTween } from "@/lib/motion";
import { useGsapStagger } from "@/hooks/useGsapStagger";
import type { DatasetResponse, RunResult } from "@/lib/api/client";

function ProgressBar({ progress, training }: { progress: number; training: boolean }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!barRef.current) return;
    gsap.to(barRef.current, safeTween({
      width: `${progress}%`,
      duration: 0.3,
      ease: EASES.out,
    }));
  }, [progress]);

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        ref={barRef}
        className={cn(
          "h-full rounded-full bg-primary",
          training && progress < 100 && "progress-track"
        )}
        style={{ width: 0 }}
      />
    </div>
  );
}

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
  const stepsRef = useGsapStagger<HTMLUListElement>(steps.length > 0 ? "steps" : null);

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
      <div className="reveal space-y-5" aria-live="polite">
        <div className="flex flex-col gap-3 rounded-2xl border bg-card p-5 sm:flex-row sm:items-end shadow-sm">
          <label className="flex flex-col gap-1.5 text-sm flex-1">
            <span className="text-muted-foreground">Column to predict</span>
            <select
              value={target}
              onChange={(e) => onTargetChange(e.target.value)}
              disabled={training}
              className="h-9 w-full rounded-lg border border-input bg-background px-3 pr-8 text-sm outline-none transition-[box-shadow,border-color] duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-ring appearance-none sm:w-64"
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
                  <Spinner className="size-4" /> Training\u2026
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
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <ProgressBar progress={progress} training={training} />
            <ul ref={stepsRef} className="mt-4 space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>
                    <span className="font-medium capitalize">{s.name}</span>
                    <span className="text-muted-foreground">: {s.explanation}</span>
                  </span>
                </li>
              ))}
              {training && (
                <li className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" /> Working\u2026
                </li>
              )}
            </ul>
          </div>
        )}

        {runError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {runError}
          </div>
        )}

        {result && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-success/30 bg-success/[0.06] p-4">
            <CheckCircle2 className="size-5 text-success" />
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
