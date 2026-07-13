"""Shared I/O and type-detection utilities for the ML pipeline."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def dataset_path(dataset_id: str) -> Path:
    return settings.runs_dir / dataset_id / "raw.csv"


def load_dataframe(dataset_id: str) -> pd.DataFrame:
    path = dataset_path(dataset_id)
    if not path.exists():
        raise FileNotFoundError(f"Dataset '{dataset_id}' not found.")
    return pd.read_csv(path)


def detect_problem_type(y: pd.Series) -> tuple[str, str]:
    """Return (problem_type, human-readable reason) for the target series."""
    if (
        y.dtype == object
        or pd.api.types.is_bool_dtype(y)
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
