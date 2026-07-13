"""Shared statistical utilities for profiling and evaluation."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from app.schemas.run import Correlation

MAX_CORR_COLS = 30


def clean_float(value: float) -> float:
    """Coerce NaN/inf to 0.0 so the result is JSON-serialisable."""
    if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
        return 0.0
    return float(value)


def compute_correlation(df: pd.DataFrame, max_cols: int = MAX_CORR_COLS) -> Correlation | None:
    """Numeric Pearson correlation capped at `max_cols` columns for readability."""
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])][:max_cols]
    if len(numeric_cols) < 2:
        return None
    corr_df = df[numeric_cols].corr(numeric_only=True).fillna(0.0)
    labels = [str(c) for c in corr_df.columns]
    matrix = [[round(clean_float(v), 4) for v in row] for row in corr_df.to_numpy()]
    return Correlation(labels=labels, matrix=matrix)
