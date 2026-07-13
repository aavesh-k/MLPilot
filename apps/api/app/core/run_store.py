"""Run metadata lookup and persistence.

Runs live under ``runs/<dataset_id>/<run_id>/`` on disk. No database — for MVP
the filesystem is the store. Lookups fall back to scanning disk when the
in-memory cache misses (e.g. after a server restart).
"""

from __future__ import annotations

import json
import time
from functools import lru_cache
from pathlib import Path

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.run import RunResult

logger = get_logger(__name__)


def new_run_id() -> str:
    return f"run_{int(time.time() * 1000)}"


def write_run_meta(run_dir: Path, dataset_id: str, target: str) -> None:
    run_dir.mkdir(parents=True, exist_ok=True)
    meta = {"dataset_id": dataset_id, "target": target}
    (run_dir / "run_meta.json").write_text(json.dumps(meta), encoding="utf-8")


def read_run_meta(run_dir: Path) -> dict | None:
    meta_path = run_dir / "run_meta.json"
    if not meta_path.exists():
        return None
    try:
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _scan_for_run(run_id: str) -> Path | None:
    """Scan disk for a directory matching ``run_id``."""
    for dataset_dir in settings.runs_dir.iterdir():
        candidate = dataset_dir / run_id
        if candidate.is_dir():
            return candidate
    return None


@lru_cache(maxsize=128)
def find_run_dir(run_id: str) -> Path | None:
    """Resolve a run directory, caching the result."""
    return _scan_for_run(run_id)


def load_result(run_id: str) -> RunResult | None:
    run_dir = find_run_dir(run_id)
    if run_dir is None:
        return None
    result_path = run_dir / "result.json"
    if not result_path.exists():
        return None
    return RunResult.model_validate_json(result_path.read_text(encoding="utf-8"))


def list_runs() -> list[RunResult]:
    """List completed runs across all datasets (newest first)."""
    results: list[RunResult] = []
    for dataset_dir in settings.runs_dir.iterdir():
        if not dataset_dir.is_dir():
            continue
        for run_dir in dataset_dir.iterdir():
            result_path = run_dir / "result.json"
            if run_dir.is_dir() and result_path.exists():
                try:
                    results.append(
                        RunResult.model_validate_json(result_path.read_text(encoding="utf-8"))
                    )
                except Exception as exc:
                    logger.warning("Skipping unreadable result %s: %s", result_path, exc)
    results.sort(key=lambda r: r.created_at, reverse=True)
    return results


def clear_run_cache() -> None:
    find_run_dir.cache_clear()
