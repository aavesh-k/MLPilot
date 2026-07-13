import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Evaluation } from "@/lib/api/client";
import ConfusionMatrix from "./ConfusionMatrix";
import RocCurve from "./RocCurve";
import ClassDistribution from "./ClassDistribution";
import PredVsActual from "./PredVsActual";
import ResidualPlot from "./ResidualPlot";
import CorrelationHeatmap from "./CorrelationHeatmap";

/**
 * Visualizations for the best model, rendered conditionally by problem type.
 * All chart data is computed server-side (M5); this only lays it out.
 */
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Visualizations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
      </CardContent>
    </Card>
  );
}
