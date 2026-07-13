"""AutoML training engine.

Trains and compares several scikit-learn pipelines for a chosen target column,
detects whether the problem is classification or regression, ranks the models,
and exports artifacts (best model, test predictions, report).

Everything here is synchronous and CPU bound; callers should run it in a worker
thread (see ``app.api.routers.stream``) so the event loop stays free.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

import joblib
import numpy as np
import pandas as pd
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    AdaBoostClassifier,
    ExtraTreesClassifier,
    ExtraTreesRegressor,
    HistGradientBoostingClassifier,
    HistGradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.inspection import permutation_importance
from sklearn.linear_model import (
    ElasticNet,
    Lasso,
    LinearRegression,
    LogisticRegression,
    Ridge,
)
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix as sk_confusion_matrix,
    f1_score,
    log_loss,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
    roc_curve as sk_roc_curve,
)
from sklearn.model_selection import KFold, StratifiedKFold, cross_validate, train_test_split
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer

from app.core.config import settings
from app.core.io import load_dataframe, detect_problem_type
from app.core.logging import get_logger
from app.core.stats import compute_correlation
from app.schemas.run import (
    RunResult,
    ModelResult,
    FeatureImportance,
    CleaningSummary,
    CappedColumn,
    Evaluation,
    ConfusionMatrix,
    RocCurve,
    ClassCount,
    PredPoint,
    ResidualPoint,
)

logger = get_logger(__name__)

# Cap the number of rows used for training so the demo stays responsive on big
# files. Sampling is stratified for classification to preserve class balance.
MAX_TRAIN_ROWS = 30_000
CV_FOLDS = 5
MAX_IMPORTANCE_ROWS = 800

_N_JOBS = min(4, os.cpu_count() or 1)

ProgressFn = Callable[[dict[str, Any]], None]


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
    def _make(pre, estimator):
        return make_pipeline(pre(), estimator)

    pre = lambda: _build_preprocessor(numeric, categorical)
    if problem_type == "classification":
        return {
            "Logistic Regression": _make(pre, LogisticRegression(max_iter=1000)),
            "Decision Tree": _make(pre, DecisionTreeClassifier(random_state=42)),
            "Random Forest": _make(pre, RandomForestClassifier(n_estimators=200, n_jobs=_N_JOBS, random_state=42)),
            "Extra Trees": _make(pre, ExtraTreesClassifier(n_estimators=200, n_jobs=_N_JOBS, random_state=42)),
            "Gradient Boosting": _make(pre, HistGradientBoostingClassifier(random_state=42)),
            "AdaBoost": _make(pre, AdaBoostClassifier(random_state=42)),
            "K-Nearest Neighbors": _make(pre, KNeighborsClassifier()),
            "Support Vector Machine": _make(pre, SVC(probability=True, random_state=42)),
            "Naive Bayes": _make(pre, GaussianNB()),
        }
    return {
        "Linear Regression": _make(pre, LinearRegression()),
        "Ridge Regression": _make(pre, Ridge(random_state=42)),
        "Lasso Regression": _make(pre, Lasso(random_state=42)),
        "Elastic Net": _make(pre, ElasticNet(random_state=42)),
        "Decision Tree": _make(pre, DecisionTreeRegressor(random_state=42)),
        "Random Forest": _make(pre, RandomForestRegressor(n_estimators=200, n_jobs=_N_JOBS, random_state=42)),
        "Extra Trees": _make(pre, ExtraTreesRegressor(n_estimators=200, n_jobs=_N_JOBS, random_state=42)),
        "Gradient Boosting": _make(pre, HistGradientBoostingRegressor(random_state=42)),
    }


def _metrics_for(
    problem_type: str,
    y_true: pd.Series,
    y_pred: np.ndarray,
    y_proba: np.ndarray | None = None,
    y_proba_full: np.ndarray | None = None,
    classes: np.ndarray | None = None,
    n_features: int | None = None,
):
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
                logger.debug("roc_auc_score failed for a model")
        if y_proba_full is not None:
            try:
                out["log_loss"] = float(log_loss(y_true, y_proba_full, labels=classes))
            except (ValueError, IndexError):
                logger.debug("log_loss failed for a model")
        return out

    r2 = float(r2_score(y_true, y_pred))
    mse = float(mean_squared_error(y_true, y_pred))
    out = {
        "r2": r2,
        "rmse": float(np.sqrt(mse)),
        "mse": mse,
        "mae": float(mean_absolute_error(y_true, y_pred)),
    }
    if n_features is not None:
        n = len(y_true)
        p = n_features
        out["adjusted_r2"] = (
            float(1 - (1 - r2) * (n - 1) / (n - p - 1)) if (n - p - 1) > 0 else r2
        )
    return out


def _feature_importance(pipeline: Any, X: pd.DataFrame, y: pd.Series, scorer: str) -> list[FeatureImportance]:
    try:
        sample = X.sample(min(MAX_IMPORTANCE_ROWS, len(X)), random_state=42)
        y_sample = y.loc[sample.index]
        result = permutation_importance(
            pipeline,
            sample,
            y_sample,
            n_repeats=5,
            random_state=42,
            scoring=scorer,
        )
        importances = result.importances_mean
    except Exception as exc:
        logger.warning("Permutation importance failed: %s", exc)
        return []

    rows = [
        FeatureImportance(feature=str(col), importance=float(imp))
        for col, imp in zip(X.columns, importances)
        if not np.isnan(imp)
    ]
    rows.sort(key=lambda r: r.importance, reverse=True)
    return rows[:10]


MAX_SCATTER_POINTS = 500
MAX_ROC_POINTS = 100


def _downsample_indices(n: int, k: int) -> list[int]:
    """Evenly spaced indices (first & last included) for thinning an ordered curve."""
    if n <= k:
        return list(range(n))
    return sorted({int(round(i * (n - 1) / (k - 1))) for i in range(k)})


def _sample_indices(n: int, k: int) -> list[int]:
    """A reproducible random subset of row positions for scatter plots."""
    if n <= k:
        return list(range(n))
    rng = np.random.default_rng(42)
    return sorted(int(i) for i in rng.choice(n, size=k, replace=False))


def _build_evaluation(
    problem_type: str,
    pipeline: Any,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    X_clean: pd.DataFrame,
) -> Evaluation:
    """Chart-ready evaluation data for the best model on the hold-out set."""
    ev = Evaluation(correlation=compute_correlation(X_clean))
    y_pred = pipeline.predict(X_test)

    if problem_type == "classification":
        classes = list(getattr(pipeline, "classes_", sorted(pd.unique(y_test))))
        cm = sk_confusion_matrix(y_test, y_pred, labels=classes)
        ev.confusion_matrix = ConfusionMatrix(
            labels=[str(c) for c in classes],
            matrix=[[int(v) for v in row] for row in cm],
        )
        vc = y_test.value_counts()
        ev.class_distribution = [
            ClassCount(label=str(c), count=int(vc.get(c, 0))) for c in classes
        ]
        if len(classes) == 2 and hasattr(pipeline, "predict_proba"):
            try:
                proba = pipeline.predict_proba(X_test)[:, 1]
                fpr, tpr, _ = sk_roc_curve(y_test, proba, pos_label=classes[1])
                idx = _downsample_indices(len(fpr), MAX_ROC_POINTS)
                ev.roc_curve = RocCurve(
                    fpr=[float(fpr[i]) for i in idx],
                    tpr=[float(tpr[i]) for i in idx],
                    auc=float(roc_auc_score(y_test, proba)),
                )
            except (ValueError, IndexError):
                pass
        return ev

    # Regression: sampled predicted-vs-actual and residual points.
    actual = y_test.to_numpy(dtype=float)
    pred = np.asarray(y_pred, dtype=float)
    idx = _sample_indices(len(actual), MAX_SCATTER_POINTS)
    ev.pred_vs_actual = [
        PredPoint(actual=float(actual[i]), predicted=float(pred[i])) for i in idx
    ]
    ev.residuals = [
        ResidualPoint(predicted=float(pred[i]), residual=float(actual[i] - pred[i]))
        for i in idx
    ]
    return ev


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


IQR_MULTIPLIER = 1.5


def clean_dataframe(df: pd.DataFrame, target: str) -> tuple[pd.DataFrame, CleaningSummary]:
    """Explicit, visible cleaning applied before training.

    Drops duplicate rows, drops constant/all-empty columns, drops rows with
    missing target values, and caps numeric outliers to the IQR fences
    (excluding the target). Imputation/scaling/encoding stay inside the model
    pipeline; the strategy is recorded here for transparency.
    Returns the cleaned dataframe and a summary of what changed.
    """
    df = df.copy()
    rows_before = len(df)

    # 1. Drop exact duplicate rows.
    deduped = df.drop_duplicates()
    dropped_dupes = rows_before - len(deduped)
    df = deduped

    # 2. Drop constant / all-empty columns (never the target).
    dropped_cols: list[str] = []
    for c in df.columns:
        if c == target:
            continue
        if df[c].isna().all() or df[c].nunique(dropna=True) <= 1:
            dropped_cols.append(c)
    if dropped_cols:
        df = df.drop(columns=dropped_cols)

    # 3. Drop rows where the target is missing.
    rows_before_null_drop = len(df)
    df = df.loc[df[target].notna()]
    dropped_target_null = rows_before_null_drop - len(df)

    # 4. IQR outlier capping on numeric feature columns (never the target).
    capped_cols: list[CappedColumn] = []
    numeric_features = [
        c
        for c in df.columns
        if c != target and pd.api.types.is_numeric_dtype(df[c])
    ]
    for c in numeric_features:
        col = df[c]
        q1 = col.quantile(0.25)
        q3 = col.quantile(0.75)
        iqr = q3 - q1
        if not np.isfinite(iqr) or iqr == 0:
            continue
        low = q1 - IQR_MULTIPLIER * iqr
        high = q3 + IQR_MULTIPLIER * iqr
        n_capped = int(((col < low) | (col > high)).sum())
        if n_capped > 0:
            df[c] = col.clip(lower=low, upper=high)
            capped_cols.append(CappedColumn(col=str(c), count=n_capped))

    impute_strategy = {"numeric": "median", "categorical": "most_frequent"}

    summary = CleaningSummary(
        dropped_dupes=int(dropped_dupes),
        dropped_cols=[str(c) for c in dropped_cols],
        capped_cols=capped_cols,
        impute_strategy=impute_strategy,
        rows_before=int(rows_before),
        rows_after=int(len(df)),
    )
    return df, summary


_BRAND = colors.HexColor("#4f46e5")
_INK = colors.HexColor("#1e293b")
_MUTED = colors.HexColor("#64748b")
_LINE = colors.HexColor("#e2e8f0")
_ZEBRA = colors.HexColor("#f8fafc")
_BAR = colors.HexColor("#6366f1")
_BAR_BG = colors.HexColor("#eef2ff")


def _pdf_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "amlTitle", parent=base["Title"], fontSize=22, leading=26,
            textColor=_INK, spaceAfter=2,
        ),
        "subtitle": ParagraphStyle(
            "amlSubtitle", parent=base["Normal"], fontSize=10, leading=14,
            textColor=_MUTED, spaceAfter=6,
        ),
        "h2": ParagraphStyle(
            "amlH2", parent=base["Heading2"], fontSize=13, leading=16,
            textColor=_BRAND, spaceBefore=14, spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "amlBody", parent=base["Normal"], fontSize=9.5, leading=14,
            textColor=_INK, alignment=TA_LEFT,
        ),
        "cell": ParagraphStyle(
            "amlCell", parent=base["Normal"], fontSize=8.5, leading=11,
            textColor=_INK,
        ),
        "cellHead": ParagraphStyle(
            "amlCellHead", parent=base["Normal"], fontSize=8.5, leading=11,
            textColor=colors.white, fontName="Helvetica-Bold",
        ),
        "meta": ParagraphStyle(
            "amlMeta", parent=base["Normal"], fontSize=9.5, leading=15,
            textColor=_INK,
        ),
    }


def _write_pdf_report(
    path: Path,
    *,
    dataset_id: str,
    target: str,
    problem_type: str,
    primary_metric: str,
    n_rows: int,
    n_features: int,
    best: ModelResult,
    results: list[ModelResult],
    insights: list[str],
    importances: list[FeatureImportance],
    cleaning: CleaningSummary,
    created_at: str,
) -> None:
    """Render a polished PDF summary of the run with reportlab (pure-Python)."""
    st = _pdf_styles()
    doc = SimpleDocTemplate(
        str(path), pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm,
        title="AutoML Studio report", author="AutoML Studio",
    )
    story: list[Any] = []

    story.append(Paragraph("AutoML Studio — Model Report", st["title"]))
    story.append(Paragraph(f"Generated {created_at}", st["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=_LINE, spaceAfter=10))

    story.append(Paragraph("Run summary", st["h2"]))
    meta_rows = [
        ("Dataset", dataset_id),
        ("Target", target),
        ("Task", problem_type.capitalize()),
        ("Rows", f"{n_rows:,}"),
        ("Features used", str(n_features)),
        ("Primary metric", primary_metric),
        ("Best model", f"{best.name} ({primary_metric} = {best.primary_score:.4f})"),
    ]
    meta_tbl = Table(
        [[Paragraph(f"<b>{k}</b>", st["meta"]), Paragraph(str(v), st["meta"])] for k, v in meta_rows],
        colWidths=[38 * mm, 136 * mm],
    )
    meta_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(meta_tbl)

    story.append(Paragraph("Model comparison", st["h2"]))
    if problem_type == "classification":
        headers = ["#", "Model", "Accuracy", "F1", "ROC-AUC", "CV mean", "CV std"]
        metric_keys = ["accuracy", "f1", "roc_auc"]
    else:
        headers = ["#", "Model", "R²", "RMSE", "MAE", "CV mean", "CV std"]
        metric_keys = ["r2", "rmse", "mae"]

    data = [[Paragraph(h, st["cellHead"]) for h in headers]]
    for r in results:
        cells = [str(r.rank), r.name]
        cells += [f"{r.metrics.get(k, 0):.4f}" for k in metric_keys]
        cells += [f"{r.cv_mean:.4f}", f"{r.cv_std:.4f}"]
        data.append([Paragraph(c, st["cell"]) for c in cells])

    comp_tbl = Table(
        data,
        colWidths=[8 * mm, 46 * mm, 24 * mm, 24 * mm, 24 * mm, 24 * mm, 24 * mm],
        repeatRows=1,
    )
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), _BRAND),
        ("GRID", (0, 0), (-1, -1), 0.5, _LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), _ZEBRA))
    style.append(("BACKGROUND", (0, 1), (-1, 1), _BAR_BG))
    style.append(("FONTNAME", (1, 1), (1, 1), "Helvetica-Bold"))
    comp_tbl.setStyle(TableStyle(style))
    story.append(comp_tbl)

    if insights:
        story.append(Paragraph("Key insights", st["h2"]))
        story.append(ListFlowable(
            [ListItem(Paragraph(i, st["body"]), leftIndent=6) for i in insights],
            bulletType="bullet", bulletColor=_BRAND, leftIndent=12,
        ))

    if importances:
        story.append(Paragraph("Top features (permutation importance)", st["h2"]))
        max_imp = max((abs(f.importance) for f in importances), default=1e-9) or 1e-9
        rows = []
        for f in importances:
            frac = max(0.0, min(1.0, abs(f.importance) / max_imp))
            bar_w = 60 * mm
            filled = Table([[""]], colWidths=[max(0.4, frac * bar_w)], rowHeights=[4.5 * mm])
            filled.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), _BAR),
                ("LINEBEFORE", (0, 0), (-1, -1), 0, _BAR),
            ]))
            rows.append([
                Paragraph(f.feature, st["cell"]),
                filled,
                Paragraph(f"{f.importance:.4f}", st["cell"]),
            ])
        feat_tbl = Table(rows, colWidths=[60 * mm, 62 * mm, 22 * mm])
        feat_tbl.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (2, 0), (2, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 2.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ("LEFTPADDING", (1, 0), (1, -1), 0),
        ]))
        story.append(feat_tbl)

    story.append(Paragraph("Cleaning summary", st["h2"]))
    dropped_cols_text = ", ".join(cleaning.dropped_cols) if cleaning.dropped_cols else "none"
    capped = (
        ", ".join(f"{c.col} ({c.count})" for c in cleaning.capped_cols)
        if cleaning.capped_cols else "none"
    )
    clean_items = [
        f"Rows: {cleaning.rows_before:,} → {cleaning.rows_after:,} "
        f"(dropped {cleaning.dropped_dupes:,} duplicate row(s), "
        f"dropped {cleaning.rows_before - cleaning.rows_after - cleaning.dropped_dupes} row(s) missing target)",
        f"Dropped columns: {dropped_cols_text}",
        f"Outlier-capped columns: {capped}",
        f"Imputation: numeric → {cleaning.impute_strategy.get('numeric')}, "
        f"categorical → {cleaning.impute_strategy.get('categorical')}",
    ]
    story.append(ListFlowable(
        [ListItem(Paragraph(i, st["body"]), leftIndent=6) for i in clean_items],
        bulletType="bullet", bulletColor=_BRAND, leftIndent=12,
    ))

    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_LINE, spaceAfter=4))
    story.append(Paragraph(
        "Generated by AutoML Studio — upload a CSV, pick a target, get a trained, "
        "compared, and explained model.",
        st["subtitle"],
    ))

    doc.build(story)


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

    y_raw = df[target]
    problem_type, reason = detect_problem_type(y_raw)
    emit({"type": "step", "name": "analyze", "explanation": f"Detected a {problem_type} problem — {reason}", "pct": 35})

    run_dir.mkdir(parents=True, exist_ok=True)
    cleaned_df, cleaning = clean_dataframe(df, target)
    cleaned_path = run_dir / "cleaned.csv"
    cleaned_df.to_csv(cleaned_path, index=False)

    cap_note = (
        f"capped outliers in {len(cleaning.capped_cols)} column(s)"
        if cleaning.capped_cols
        else "no outliers to cap"
    )
    emit({
        "type": "step",
        "name": "clean",
        "explanation": (
            f"Cleaned data — dropped {cleaning.dropped_dupes:,} duplicate row(s), "
            f"{len(cleaning.dropped_cols)} constant/empty column(s), {cap_note}."
        ),
        "pct": 42,
    })

    X = cleaned_df.drop(columns=[target])
    y = cleaned_df[target]
    numeric = [c for c in X.columns if pd.api.types.is_numeric_dtype(X[c])]
    categorical = [c for c in X.columns if not pd.api.types.is_numeric_dtype(X[c])]

    emit({"type": "step", "name": "prepare", "explanation": f"Built preprocessing pipeline ({len(numeric)} numeric → impute+scale, {len(categorical)} categorical → encode).", "pct": 50})

    # Sample for speed on very large files.
    sampled = len(X) > MAX_TRAIN_ROWS
    if sampled:
        try:
            stratify = y if problem_type == "classification" else None
            idx = X.sample(MAX_TRAIN_ROWS, random_state=42, stratify=stratify).index
            X, y = X.loc[idx], y.loc[idx]
        except ValueError:
            logger.warning("Stratified sampling failed; falling back to random sample.")
            idx = X.sample(MAX_TRAIN_ROWS, random_state=42).index
            X, y = X.loc[idx], y.loc[idx]

    test_size = 0.2
    stratify = y if problem_type == "classification" else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42, stratify=stratify
    )

    models = _build_models(problem_type, numeric, categorical)

    # Use accuracy / r2 for CV (always available); promote to roc_auc for
    # ranking when the test set supports it.
    scorer = "accuracy" if problem_type == "classification" else "r2"
    primary_metric = scorer

    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=42) if problem_type == "classification" else KFold(n_splits=CV_FOLDS, shuffle=True, random_state=42)

    results: list[ModelResult] = []
    best_pipeline: Any = None
    best_score = -np.inf
    for name, pipe in models.items():
        cv_res = cross_validate(pipe, X_train, y_train, cv=cv, scoring=scorer, n_jobs=_N_JOBS)
        cv_mean = float(np.mean(cv_res["test_score"]))
        cv_std = float(np.std(cv_res["test_score"]))
        pipe.fit(X_train, y_train)
        y_pred = pipe.predict(X_test)
        has_proba = hasattr(pipe, "predict_proba") and problem_type == "classification"
        y_proba_full = pipe.predict_proba(X_test) if has_proba else None
        y_proba = (
            y_proba_full[:, 1]
            if (y_proba_full is not None and y_test.nunique() == 2)
            else None
        )
        metrics = _metrics_for(
            problem_type,
            y_test,
            y_pred,
            y_proba,
            y_proba_full,
            getattr(pipe, "classes_", None),
            X_train.shape[1],
        )

        # Promote primary_metric to roc_auc after seeing the first model's metrics.
        if problem_type == "classification" and "roc_auc" in metrics and primary_metric == "accuracy":
            primary_metric = "roc_auc"

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

    # Compute actual encoded feature count for adjusted_r2 / reports.
    try:
        transformed = best_pipeline[:-1].fit_transform(X_train)
        n_features_actual = transformed.shape[1]
    except Exception:
        n_features_actual = X.shape[1]

    importances = _feature_importance(best_pipeline, X_test, y_test, primary_metric if problem_type == "regression" else "roc_auc" if primary_metric == "roc_auc" else "accuracy")
    emit({"type": "step", "name": "explain", "explanation": f"Computed feature importances via permutation; top driver: {importances[0].feature if importances else 'n/a'}.", "pct": 97})

    # Use feature-only matrix for evaluation correlation.
    evaluation = _build_evaluation(problem_type, best_pipeline, X_test, y_test, X)
    emit({"type": "step", "name": "visualize", "explanation": "Prepared evaluation charts (confusion matrix / ROC / residuals) from the hold-out set.", "pct": 98})

    # Persist artifacts.
    run_dir.mkdir(parents=True, exist_ok=True)
    model_path = run_dir / "best_model.joblib"
    preds_path = run_dir / "test_predictions.csv"
    result_path = run_dir / "result.json"
    report_path = run_dir / "report.md"
    pdf_path = run_dir / "report.pdf"

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
        n_features=int(n_features_actual),
        primary_metric=primary_metric,
        best_model=best.name,
        models=results,
        feature_importance=importances,
        insights=insights,
        cleaning=cleaning,
        evaluation=evaluation,
        artifacts={
            "model": model_path.name,
            "predictions": preds_path.name,
            "report": report_path.name,
            "cleaned": cleaned_path.name,
            "pdf": pdf_path.name,
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
        f"- Rows: {n_rows:,} · Features used: {n_features_actual}",
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
    lines += ["", "## Cleaning summary", ""]
    lines += [
        f"- Rows: {cleaning.rows_before:,} → {cleaning.rows_after:,} "
        f"(dropped {cleaning.dropped_dupes:,} duplicate row(s))",
        f"- Dropped columns: {', '.join(cleaning.dropped_cols) if cleaning.dropped_cols else 'none'}",
        f"- Outlier-capped columns: "
        + (
            ", ".join(f"{c.col} ({c.count})" for c in cleaning.capped_cols)
            if cleaning.capped_cols
            else "none"
        ),
        f"- Imputation: numeric → {cleaning.impute_strategy.get('numeric')}, "
        f"categorical → {cleaning.impute_strategy.get('categorical')}",
    ]
    lines += ["", "## Key insights", ""]
    lines += [f"- {i}" for i in insights]
    if importances:
        lines += ["", "## Top features (permutation importance)", ""]
        lines += [f"- {r.feature}: {r.importance:.4f}" for r in importances]
    report_path.write_text("\n".join(lines), encoding="utf-8")

    # PDF report (reportlab, pure-Python — no system deps). Best-effort: a PDF
    # failure must not sink an otherwise successful run.
    try:
        _write_pdf_report(
            pdf_path,
            dataset_id=dataset_id,
            target=target,
            problem_type=problem_type,
            primary_metric=primary_metric,
            n_rows=int(n_rows),
            n_features=int(n_features_actual),
            best=best,
            results=results,
            insights=insights,
            importances=importances,
            cleaning=cleaning,
            created_at=result.created_at,
        )
        emit({"type": "step", "name": "export", "explanation": "Generated the downloadable PDF report (tables, insights, importances).", "pct": 99})
    except Exception as exc:
        logger.warning("PDF report generation failed: %s", exc)
        result.artifacts.pop("pdf", None)
        result_path.write_text(result.model_dump_json(indent=2), encoding="utf-8")

    emit({"type": "done", "message": f"Trained {len(results)} models. Best: {best.name} ({primary_metric} = {best.primary_score:.3f})."})
    emit({"type": "result", "result": json.loads(result.model_dump_json())})
    return result
