import type { Evaluation } from "@/lib/api/client";
import ConfusionMatrix from "./ConfusionMatrix";
import RocCurve from "./RocCurve";
import ClassDistribution from "./ClassDistribution";
import PredVsActual from "./PredVsActual";
import ResidualPlot from "./ResidualPlot";
import CorrelationHeatmap from "./CorrelationHeatmap";

export default function EvaluationCharts({
  evaluation,
  problemType,
}: {
  evaluation: Evaluation | null | undefined;
  problemType: string;
}) {
  if (!evaluation) return null;
  const isClf = problemType === "classification";

  const hasContent =
    evaluation.correlation ||
    (isClf
      ? evaluation.confusion_matrix ||
        evaluation.roc_curve ||
        evaluation.class_distribution.length > 0
      : evaluation.pred_vs_actual.length > 0 || evaluation.residuals.length > 0);

  if (!hasContent) return null;

  return (
    <div className="surface-raised p-5">
      <p className="mb-5 text-sm font-medium">Visualizations</p>
      <div className="space-y-6">
        {isClf ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {evaluation.confusion_matrix && (
              <ConfusionMatrix data={evaluation.confusion_matrix} />
            )}
            {evaluation.roc_curve && <RocCurve data={evaluation.roc_curve} />}
            {evaluation.class_distribution.length > 0 && (
              <ClassDistribution data={evaluation.class_distribution} />
            )}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {evaluation.pred_vs_actual.length > 0 && (
              <PredVsActual data={evaluation.pred_vs_actual} />
            )}
            {evaluation.residuals.length > 0 && (
              <ResidualPlot data={evaluation.residuals} />
            )}
          </div>
        )}

        {evaluation.correlation && (
          <div className="border-t border-border pt-6">
            <CorrelationHeatmap data={evaluation.correlation} />
          </div>
        )}
      </div>
    </div>
  );
}
