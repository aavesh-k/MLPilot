"""AutoML training engine.

Trains and compares several scikit-learn pipelines for a chosen target column,
detects whether the problem is classification or regression, ranks the models,
and exports artifacts (best model, test predictions, report).

Everything here is synchronous and CPU bound; callers should run it in a worker
thread (see ``app.api.routers.run``) so the event loop stays free.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import KFold, StratifiedKFold, cross_validate, train_test_split
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.run import RunResult, ModelResult, FeatureImportance

logger = get_logger(__name__)

# Cap the number of rows used for training so the demo stays responsive on big
# files. Sampling is stratified for classification to preserve class balance.
MAX_TRAIN_ROWS = 30_000
CV_FOLDS = 5
MAX_IMPORTANCE_ROWS = 800

ProgressFn = Callable[[dict[str, Any]], None]


def _dataset_path(dataset_id: str) -> Path:
    return settings.runs_dir / dataset_id / "raw.csv"


def load_dataframe(dataset_id: str) -> pd.DataFrame:
    path = _dataset_path(dataset_id)
    if not path.exists():
        raise FileNotFoundError(f"Dataset '{dataset_id}' not found.")
    return pd.read_csv(path)


def detect_problem_type(y: pd.Series) -> tuple[str, str]:
    """Return (problem_type, human-readable reason) for the target series."""
    if (
        y.dtype == object
        or y.dtype == bool
        or pd.api.types.is_string_dtype(y)
        or pd.api.types.is_categorical_dtype(y)
    ):
        return "classification", "is non-numeric (text or category)."

    nunique = int(y.nunique(dropna=True))
    n = len(y)
    if nunique <= 2:
        return (
            "classification",
            f"has only {nunique} distinct numeric value(s) — it behaves like a label.",
        )
    if nunique <= 20 and nunique <= 0.05 * n:
        return (
            "classification",
            f"has only {nunique} distinct values (low cardinality).",
        )
    return "regression", f"is continuous with {nunique} distinct values."


def _build_preprocessor(numeric: list[str], categorical: list[str]) -> ColumnTransformer:
    num_steps = [SimpleImputer(strategy="median"), StandardScaler()]
    cat_steps = [
        SimpleImputer(strategy="most_frequent"),
        OneHotEncoder(handle_unknown="ignore"),
    ]
    return ColumnTransformer(
        transformers=[
            ("num", make_pipeline(*num_steps), numeric),
            ("cat", make_pipeline(*cat_steps), categorical),
        ]
    )


def _build_models(problem_type: str, numeric: list[str], categorical: list[str]) -> dict[str, Any]:
    pre = lambda: _build_preprocessor(numeric, categorical)
    if problem_type == "classification":
        return {
            "Logistic Regression": make_pipeline(pre(), LogisticRegression(max_iter=1000)),
            "Random Forest": make_pipeline(pre(), RandomForestClassifier(n_estimators=200, n_jobs=-1)),
            "Gradient Boosting": make_pipeline(pre(), HistGradientBoostingClassifier()),
            "K-Nearest Neighbors": make_pipeline(pre(), KNeighborsClassifier()),
            "Naive Bayes": make_pipeline(pre(), GaussianNB()),
        }
    return {
        "Linear Regression": make_pipeline(pre(), LinearRegression()),
        "Random Forest": make_pipeline(pre(), RandomForestRegressor(n_estimators=200, n_jobs=-1)),
        "Gradient Boosting": make_pipeline(pre(), HistGradientBoostingRegressor()),
        "K-Nearest Neighbors": make_pipeline(pre(), KNeighborsRegressor()),
    }


def _metrics_for(problem_type: str, y_true: pd.Series, y_pred: np.ndarray, y_proba: np.ndarray | None):
    if problem_type == "classification":
        out: dict[str, float] = {
            "accuracy": float(accuracy_score(y_true, y_pred)),
            "f1": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
            "precision": float(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
            "recall": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
        }
        if y_proba is not None and y_true.nunique() == 2:
            try:
                out["roc_auc"] = float(roc_auc_score(y_true, y_proba))
            except ValueError:
                pass
        return out
    return {
        "r2": float(r2_score(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mae": float(mean_absolute_error(y_true, y_pred)),
    }


def _primary_metric(problem_type: str, metrics: dict[str, float]) -> str:
    if problem_type == "classification":
        return "roc_auc" if "roc_auc" in metrics else "accuracy"
    return "r2"


def _feature_importance(pipeline: Any, X: pd.DataFrame, y: pd.Series, primary_metric: str) -> list[FeatureImportance]:
    try:
        sample = X.sample(min(MAX_IMPORTANCE_ROWS, len(X)), random_state=42)
        y_sample = y.loc[sample.index]
        result = permutation_importance(
            pipeline,
            sample,
            y_sample,
            n_repeats=5,
            random_state=42,
            scoring=primary_metric,
        )
        importances = result.importances_mean
    except Exception as exc:  # noqa: BLE001 - importances are best-effort
        logger.warning("Permutation importance failed: %s", exc)
        return []

    rows = [
        FeatureImportance(feature=str(col), importance=float(imp))
        for col, imp in zip(X.columns, importances)
        if not np.isnan(imp)
    ]
    rows.sort(key=lambda r: r.importance, reverse=True)
    return rows[:10]


def _build_insights(
    target: str,
    problem_type: str,
    reason: str,
    models: list[ModelResult],
    best: ModelResult,
    importances: list[FeatureImportance],
    sampled: bool,
    train_rows: int,
) -> list[str]:
    insights: list[str] = []
    insights.append(
        f"This is a {problem_type} problem: the target '{target}' {reason}"
    )
    insights.append(
        f"We trained and compared {len(models)} models, ranked by "
        f"{best.primary_metric} on a held-out test set."
    )
    top_features = ", ".join(r.feature for r in importances[:3]) or "none detected"
    if problem_type == "classification":
        insights.append(
            f"The best model is {best.name} with {best.primary_metric} = "
            f"{best.primary_score:.3f} (accuracy {best.metrics.get('accuracy', 0):.3f})."
        )
        insights.append(f"The most influential features were: {top_features}.")
    else:
        insights.append(
            f"The best model is {best.name} with R² = {best.metrics['r2']:.3f} "
            f"(typical error MAE = {best.metrics['mae']:.3f})."
        )
        insights.append(f"The most influential features were: {top_features}.")
    if sampled:
        insights.append(
            f"Training used a stratified sample of {train_rows:,} rows to keep things fast; "
            "the full file is still available for export."
        )
    insights.append(
        "Download the best model, its test-set predictions, or a plain-text report from the results panel."
    )
    return insights


def train_and_compare(
    run_id: str,
    dataset_id: str,
    target: str,
    run_dir: Path,
    emit: ProgressFn,
) -> RunResult:
    """Train, compare, rank, explain, and persist artifacts for one run."""
    df = load_dataframe(dataset_id)
    n_rows, n_cols = df.shape

    emit({"type": "step", "name": "ingest", "explanation": f"Loaded {n_rows:,} rows × {n_cols:,} columns from your CSV.", "pct": 15})

    if target not in df.columns:
        raise ValueError(f"Target column '{target}' not found in the dataset.")
    if df[target].isna().all():
        raise ValueError(f"Target column '{target}' has no usable values.")

    y = df[target]
    problem_type, reason = detect_problem_type(y)
    emit({"type": "step", "name": "analyze", "explanation": f"Detected a {problem_type} problem — {reason}", "pct": 35})

    # Drop unusable feature columns: all-missing or constant (no signal).
    X = df.drop(columns=[target])
    constant_cols = [c for c in X.columns if X[c].nunique(dropna=True) <= 1]
    if constant_cols:
        X = X.drop(columns=constant_cols)

    # Drop rows missing the target; impute features later in the pipeline.
    mask = y.notna()
    X, y = X.loc[mask], y.loc[mask]
    numeric = [c for c in X.columns if pd.api.types.is_numeric_dtype(X[c])]
    categorical = [c for c in X.columns if not pd.api.types.is_numeric_dtype(X[c])]

    emit({"type": "step", "name": "prepare", "explanation": f"Built preprocessing pipeline ({len(numeric)} numeric → impute+scale, {len(categorical)} categorical → encode).", "pct": 50})

    # Sample for speed on very large files.
    sampled = len(X) > MAX_TRAIN_ROWS
    if sampled:
        stratify = y if problem_type == "classification" else None
        idx = X.sample(MAX_TRAIN_ROWS, random_state=42, stratify=stratify).index
        X, y = X.loc[idx], y.loc[idx]

    test_size = 0.2
    stratify = y if problem_type == "classification" else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=stratify
    )

    models = _build_models(problem_type, numeric, categorical)
    primary_metric = _primary_metric(problem_type, {})
    scorer = primary_metric if problem_type == "regression" else (
        "roc_auc" if primary_metric == "roc_auc" else "accuracy"
    )
    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=42) if problem_type == "classification" else KFold(n_splits=CV_FOLDS, shuffle=True, random_state=42)

    results: list[ModelResult] = []
    best_pipeline: Any = None
    best_score = -np.inf
    for name, pipe in models.items():
        cv_res = cross_validate(pipe, X_train, y_train, cv=cv, scoring=scorer, n_jobs=-1)
        cv_mean = float(np.mean(cv_res["test_score"]))
        cv_std = float(np.std(cv_res["test_score"]))
        pipe.fit(X_train, y_train)
        y_pred = pipe.predict(X_test)
        y_proba = pipe.predict_proba(X_test)[:, 1] if hasattr(pipe, "predict_proba") and problem_type == "classification" and y_test.nunique() == 2 else None
        metrics = _metrics_for(problem_type, y_test, y_pred, y_proba)
        primary_score = metrics.get(primary_metric, cv_mean)
        results.append(
            ModelResult(
                name=name,
                key=name.lower().replace(" ", "_"),
                problem_type=problem_type,
                primary_metric=primary_metric,
                primary_score=float(primary_score),
                metrics=metrics,
                cv_mean=cv_mean,
                cv_std=cv_std,
                rank=0,
                is_best=False,
            )
        )
        emit({"type": "step", "name": "train", "explanation": f"Trained {name} — {primary_metric} ≈ {primary_score:.3f} (CV).", "pct": 50 + int(40 * len(results) / len(models))})
        if primary_score > best_score:
            best_score = primary_score
            best_pipeline = pipe

    results.sort(key=lambda r: r.primary_score, reverse=True)
    for i, r in enumerate(results, start=1):
        r.rank = i
        r.is_best = i == 1

    emit({"type": "step", "name": "evaluate", "explanation": f"Evaluated {len(results)} models on a held-out test set and ranked them by {primary_metric}.", "pct": 92})

    best = results[0]
    best_pipeline.fit(X_train, y_train)
    importances = _feature_importance(best_pipeline, X_test, y_test, scorer)
    emit({"type": "step", "name": "explain", "explanation": f"Computed feature importances via permutation; top driver: {importances[0].feature if importances else 'n/a'}.", "pct": 97})

    # Persist artifacts.
    run_dir.mkdir(parents=True, exist_ok=True)
    model_path = run_dir / "best_model.joblib"
    preds_path = run_dir / "test_predictions.csv"
    result_path = run_dir / "result.json"
    report_path = run_dir / "report.md"

    joblib.dump(best_pipeline, model_path)

    pred_df = pd.DataFrame({"actual": y_test.values, "predicted": best_pipeline.predict(X_test)})
    if problem_type == "classification" and y_test.nunique() == 2 and hasattr(best_pipeline, "predict_proba"):
        pred_df["proba_positive"] = best_pipeline.predict_proba(X_test)[:, 1]
    pred_df.to_csv(preds_path, index=False)

    insights = _build_insights(target, problem_type, reason, results, best, importances, sampled, len(X))

    result = RunResult(
        run_id=run_id,
        dataset_id=dataset_id,
        target=target,
        problem_type=problem_type,
        n_rows=int(n_rows),
        n_features=int(X.shape[1]),
        primary_metric=primary_metric,
        best_model=best.name,
        models=results,
        feature_importance=importances,
        insights=insights,
        artifacts={
            "model": model_path.name,
            "predictions": preds_path.name,
            "report": report_path.name,
        },
        created_at=datetime.now().isoformat(timespec="seconds"),
    )
    result_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")

    # Human-readable report for the "Explain & Export" download.
    lines = [
        f"# AutoML Studio report",
        "",
        f"- Dataset: {dataset_id}",
        f"- Target: {target}",
        f"- Problem type: {problem_type}",
        f"- Rows: {n_rows:,} · Features used: {X.shape[1]}",
        f"- Primary metric: {primary_metric}",
        f"- Best model: {best.name} ({primary_metric} = {best.primary_score:.4f})",
        "",
        "## Model comparison",
        "",
        "| Rank | Model | " + ("Accuracy | F1 | ROC-AUC" if problem_type == "classification" else "R² | RMSE | MAE") + " | CV mean | CV std |",
        "| --- | --- | " + ("--- | --- | --- |" if problem_type == "classification" else "--- | --- | --- |") + " --- | --- |",
    ]
    for r in results:
        if problem_type == "classification":
            row = f"| {r.rank} | {r.name} | {r.metrics.get('accuracy', 0):.4f} | {r.metrics.get('f1', 0):.4f} | {r.metrics.get('roc_auc', 0):.4f} | {r.cv_mean:.4f} | {r.cv_std:.4f} |"
        else:
            row = f"| {r.rank} | {r.name} | {r.metrics.get('r2', 0):.4f} | {r.metrics.get('rmse', 0):.4f} | {r.metrics.get('mae', 0):.4f} | {r.cv_mean:.4f} | {r.cv_std:.4f} |"
        lines.append(row)
    lines += ["", "## Key insights", ""]
    lines += [f"- {i}" for i in insights]
    if importances:
        lines += ["", "## Top features (permutation importance)", ""]
        lines += [f"- {r.feature}: {r.importance:.4f}" for r in importances]
    report_path.write_text("\n".join(lines), encoding="utf-8")

    emit({"type": "result", "result": json.loads(result.model_dump_json())})
    emit({"type": "done", "message": f"Trained {len(results)} models. Best: {best.name} ({primary_metric} = {best.primary_score:.3f})."})
    return result
