"""Schemas for the dataset profiling endpoint (M2).

A profile is a read-only statistical summary computed on demand from the stored
raw CSV. It powers the "understand your data" step shown before the user picks a
target and trains models.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ProfileOverall(BaseModel):
    n_rows: int
    n_cols: int
    memory_bytes: int
    duplicate_rows: int
    missing_cells: int
    missing_pct: float
    numeric_cols: int
    categorical_cols: int
    datetime_cols: int
    constant_cols: int


class ColumnProfile(BaseModel):
    name: str
    dtype: str
    kind: str  # numeric | categorical | datetime | boolean | constant
    nulls: int
    null_pct: float
    unique: int
    is_constant: bool
    # Numeric-only stats.
    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None
    std: Optional[float] = None
    # Categorical-only stats.
    top: Optional[str] = None
    top_freq: Optional[int] = None


class ClassBalance(BaseModel):
    label: str
    count: int
    pct: float


class ProfileResponse(BaseModel):
    id: str
    overall: ProfileOverall
    columns: list[ColumnProfile]
    # Numeric Pearson correlation, aligned to `correlation_labels`.
    correlation_labels: list[str]
    correlation: list[list[float]]
    suggested_target: str
    suggested_task: str
    suggested_reason: str
    # Class distribution for the suggested target (classification only).
    class_balance: list[ClassBalance]
