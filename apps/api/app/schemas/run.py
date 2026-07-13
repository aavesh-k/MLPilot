from typing import Any, Literal

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
    artifacts: dict[str, str]
    created_at: str
