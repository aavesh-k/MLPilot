from typing import Any, Literal, Optional

from pydantic import BaseModel


class RunResponse(BaseModel):
    run_id: str


class StepEvent(BaseModel):
    type: Literal["step"] = "step"
    name: str
    explanation: str
    pct: int


class ResultEvent(BaseModel):
    type: Literal["result"] = "result"
    result: dict[str, Any]


class DoneEvent(BaseModel):
    type: Literal["done"] = "done"
    message: str = "pipeline complete"


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


# ---- ML comparison result models (persisted per run) ----

class ModelResult(BaseModel):
    name: str
    key: str
    problem_type: str
    primary_metric: str
    primary_score: float
    metrics: dict[str, float]
    cv_mean: float
    cv_std: float
    rank: int
    is_best: bool


class FeatureImportance(BaseModel):
    feature: str
    importance: float


class CappedColumn(BaseModel):
    col: str
    count: int


class CleaningSummary(BaseModel):
    dropped_dupes: int
    dropped_cols: list[str]
    capped_cols: list[CappedColumn]
    impute_strategy: dict[str, str]
    rows_before: int
    rows_after: int


# ---- M5: evaluation chart data (computed server-side from the hold-out set) ----

class ConfusionMatrix(BaseModel):
    labels: list[str]
    # Row = true class, column = predicted class; aligned to `labels`.
    matrix: list[list[int]]


class RocCurve(BaseModel):
    fpr: list[float]
    tpr: list[float]
    auc: float


class ClassCount(BaseModel):
    label: str
    count: int


class PredPoint(BaseModel):
    actual: float
    predicted: float


class ResidualPoint(BaseModel):
    predicted: float
    residual: float


class Correlation(BaseModel):
    labels: list[str]
    matrix: list[list[float]]


class Evaluation(BaseModel):
    """Chart-ready data for the best model, evaluated on the hold-out test set."""

    # Classification
    confusion_matrix: Optional[ConfusionMatrix] = None
    roc_curve: Optional[RocCurve] = None  # binary only
    class_distribution: list[ClassCount] = []
    # Regression (sampled points)
    pred_vs_actual: list[PredPoint] = []
    residuals: list[ResidualPoint] = []
    # Shared
    correlation: Optional[Correlation] = None


class RunResult(BaseModel):
    run_id: str
    dataset_id: str
    target: str
    problem_type: str
    n_rows: int
    n_features: int
    primary_metric: str
    best_model: str
    models: list[ModelResult]
    feature_importance: list[FeatureImportance]
    insights: list[str]
    cleaning: CleaningSummary
    evaluation: Optional[Evaluation] = None
    artifacts: dict[str, str]
    created_at: str
