"""Dataset profiling (M2).

Computes a statistical summary of a stored dataset: overall shape/quality,
per-column stats with an inferred "kind", a numeric correlation matrix, and a
suggested target + task. Everything is derived on demand from ``raw.csv``; no
state is persisted.
"""

from __future__ import annotations

import pandas as pd

from app.core.io import detect_problem_type, load_dataframe
from app.core.stats import clean_float, compute_correlation
from app.schemas.profile import (
    ClassBalance,
    ColumnProfile,
    ProfileOverall,
    ProfileResponse,
)

MAX_BALANCE_CLASSES = 20


def _infer_kind(series: pd.Series) -> str:
    if series.nunique(dropna=True) <= 1:
        return "constant"
    if pd.api.types.is_bool_dtype(series):
        return "boolean"
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    if series.dtype == object:
        sample = series.dropna().head(50)
        if len(sample) > 0:
            parsed = pd.to_datetime(sample, errors="coerce")
            if parsed.notna().mean() >= 0.8:
                return "datetime"
    return "categorical"


def _column_profile(name: str, series: pd.Series, kind: str, n_rows: int) -> ColumnProfile:
    nulls = int(series.isna().sum())
    unique = int(series.nunique(dropna=True))
    prof = ColumnProfile(
        name=name,
        dtype=str(series.dtype),
        kind=kind,
        nulls=nulls,
        null_pct=round(100.0 * nulls / n_rows, 2) if n_rows else 0.0,
        unique=unique,
        is_constant=kind == "constant",
    )
    if kind == "numeric":
        desc = series.dropna()
        if len(desc) > 0:
            prof.min = clean_float(desc.min())
            prof.max = clean_float(desc.max())
            prof.mean = clean_float(desc.mean())
            prof.std = clean_float(desc.std())
    elif kind in ("categorical", "boolean"):
        counts = series.dropna().value_counts()
        if len(counts) > 0:
            prof.top = str(counts.index[0])
            prof.top_freq = int(counts.iloc[0])
    return prof


def build_profile(dataset_id: str) -> ProfileResponse:
    df = load_dataframe(dataset_id)
    n_rows, n_cols = df.shape

    kinds = {col: _infer_kind(df[col]) for col in df.columns}
    columns = [_column_profile(col, df[col], kinds[col], n_rows) for col in df.columns]

    numeric_cols = [c for c in df.columns if kinds[c] == "numeric"]
    missing_cells = int(df.isna().sum().sum())
    total_cells = n_rows * n_cols

    overall = ProfileOverall(
        n_rows=int(n_rows),
        n_cols=int(n_cols),
        memory_bytes=int(df.memory_usage(deep=True).sum()),
        duplicate_rows=int(df.duplicated().sum()),
        missing_cells=missing_cells,
        missing_pct=round(100.0 * missing_cells / total_cells, 2) if total_cells else 0.0,
        numeric_cols=len(numeric_cols),
        categorical_cols=sum(1 for k in kinds.values() if k in ("categorical", "boolean")),
        datetime_cols=sum(1 for k in kinds.values() if k == "datetime"),
        constant_cols=sum(1 for k in kinds.values() if k == "constant"),
    )

    # Numeric Pearson correlation (capped for readability).
    corr = compute_correlation(df)
    correlation_labels = corr.labels if corr else []
    correlation = corr.matrix if corr else []

    # Suggest the last column as target (common convention) and detect its task.
    suggested_target = str(df.columns[-1]) if n_cols else ""
    suggested_task, suggested_reason = (
        detect_problem_type(df[suggested_target]) if suggested_target else ("", "")
    )

    class_balance: list[ClassBalance] = []
    if suggested_task == "classification" and suggested_target:
        counts = df[suggested_target].value_counts(dropna=True)
        if len(counts) <= MAX_BALANCE_CLASSES:
            total = int(counts.sum())
            class_balance = [
                ClassBalance(
                    label=str(label),
                    count=int(cnt),
                    pct=round(100.0 * int(cnt) / total, 2) if total else 0.0,
                )
                for label, cnt in counts.items()
            ]

    return ProfileResponse(
        id=dataset_id,
        overall=overall,
        columns=columns,
        correlation_labels=correlation_labels,
        correlation=correlation,
        suggested_target=suggested_target,
        suggested_task=suggested_task,
        suggested_reason=suggested_reason,
        class_balance=class_balance,
    )
