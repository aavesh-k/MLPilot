import { ArrowRight, Cpu, Scaling, SplitSquareHorizontal, Tags } from "lucide-react";
import { EmptyState } from "@/components/workspace/Section";
import { Section } from "@/components/workspace/Section";
import { cn } from "@/lib/utils";
import type { CleaningSummary } from "@/lib/api/client";

/** The automatic preprocessing pipeline. Numbers come from the cleaning summary
 *  once a run exists; otherwise the defaults (locked for V1) are shown. */
export default function PreprocessingSection({
  cleaning,
}: {
  cleaning: CleaningSummary | null;
}) {
  const numImpute = cleaning?.impute_strategy.numeric ?? "median";
  const catImpute = cleaning?.impute_strategy.categorical ?? "mode";

  const steps = [
    {
      icon: Cpu,
      title: "Impute",
      detail: `numeric → ${numImpute}, categorical → ${catImpute}`,
    },
    { icon: Tags, title: "Encode", detail: "one-hot for low-cardinality, label for high" },
    { icon: Scaling, title: "Scale", detail: "standardize numeric features" },
    { icon: SplitSquareHorizontal, title: "Split", detail: "stratified train / hold-out test" },
  ];

  if (!cleaning) {
    return (
      <Section id="preprocessing" title="Preprocessing">
        <EmptyState
          icon={<Cpu className="size-5" />}
          title="Preprocessing happens on training"
          hint="Encodings, scaling, and the train/test split are applied automatically. The exact strategy appears here after a run."
        />
      </Section>
    );
  }

  return (
    <Section
      id="preprocessing"
      title="Preprocessing"
      description="Applied automatically in a fixed, reproducible order. No options to tune in V1."
    >
      <ol className="reveal grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.title} className="relative rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Icon className="size-4" />
                </span>
                <p className="font-medium">{s.title}</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground text-pretty">{s.detail}</p>
              {i < steps.length - 1 && (
                <ArrowRight
                  className="absolute -right-2.5 top-1/2 hidden size-4 -translate-y-1/2 text-muted-foreground lg:block"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
