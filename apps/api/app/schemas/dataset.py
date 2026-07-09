from typing import Any

from pydantic import BaseModel


class ColumnInfo(BaseModel):
    name: str
    dtype: str
    nulls: int


class DatasetResponse(BaseModel):
    id: str
    filename: str
    size_bytes: int
    n_rows: int
    n_cols: int
    columns: list[ColumnInfo]
    preview: list[dict[str, Any]]
