import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/workspace/Section";
import { Section } from "@/components/workspace/Section";
import EvaluationCharts from "@/components/charts/EvaluationCharts";
import type { Evaluation } from "@/lib/api/client";

export default function VisualizationsSection({
  evaluation,
  problemType,
}: {
  evaluation: Evaluation | null | undefined;
  problemType: string;
}) {
  if (!evaluation) {
    return (
      <Section id="visualizations" title="Visualizations">
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title="No charts yet"
          hint="After training, hold-out visualizations render here — confusion / ROC for classification, predicted-vs-actual / residuals for regression, plus a correlation heatmap."
        />
      </Section>
    );
  }

  return (
    <Section
      id="visualizations"
      title="Visualizations"
      description="Computed on the hold-out set for the best model."
    >
      <div className="reveal">
        <EvaluationCharts evaluation={evaluation} problemType={problemType} />
      </div>
    </Section>
  );
}
