import asyncio
import json
from dataclasses import dataclass
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse

from app.core.config import settings
from app.core.logging import get_logger
from app.core.ml import train_and_compare
from app.schemas.run import RunResponse, RunResult

logger = get_logger(__name__)
router = APIRouter()


@dataclass
class RunMeta:
    dataset_id: str
    target: str
    run_dir: Path
    status: str = "pending"


# Single-process dev mapping of run_id -> run metadata. Replace with a store
# (DB/redis) once runs need to outlive a process or span workers.
_runs: dict[str, RunMeta] = {}


def _new_run_id() -> str:
    import time

    return f"run_{int(time.time() * 1000)}"


@router.post("/run")
def create_run(
    dataset_id: str = Query(...),
    target: str = Query(...),
) -> RunResponse:
    dataset_path = settings.runs_dir / dataset_id / "raw.csv"
    if not dataset_path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")

    run_id = _new_run_id()
    run_dir = settings.runs_dir / dataset_id / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    _runs[run_id] = RunMeta(dataset_id=dataset_id, target=target, run_dir=run_dir)
    return RunResponse(run_id=run_id)


def _find_run_dir(run_id: str) -> Path | None:
    """Resolve a run's directory from memory, or fall back to disk.

    Runs live under ``runs/<dataset_id>/<run_id>/``. The in-memory map is lost on
    restart, so we scan for a directory matching the run_id when it isn't cached.
    """
    meta = _runs.get(run_id)
    if meta:
        return meta.run_dir
    for dataset_dir in settings.runs_dir.iterdir():
        candidate = dataset_dir / run_id
        if candidate.is_dir() and (candidate / "result.json").exists():
            return candidate
    return None


def _load_result(run_id: str) -> RunResult | None:
    run_dir = _find_run_dir(run_id)
    if run_dir is None:
        return None
    result_path = run_dir / "result.json"
    if not result_path.exists():
        return None
    return RunResult.model_validate_json(result_path.read_text(encoding="utf-8"))


@router.get("/run/{run_id}/result", response_model=RunResult)
def get_result(run_id: str) -> RunResult:
    result = _load_result(run_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Run result not ready or not found.")
    return result


@router.get("/run/{run_id}/download/{kind}")
def download_artifact(run_id: str, kind: str) -> FileResponse:
    run_dir = _find_run_dir(run_id)
    if run_dir is None:
        raise HTTPException(status_code=404, detail="Run not found.")
    result = _load_result(run_id)
    if result is None or kind not in result.artifacts:
        raise HTTPException(status_code=404, detail=f"Artifact '{kind}' not available.")

    file_path = run_dir / result.artifacts[kind]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Artifact file missing.")

    media = {
        "model": "application/octet-stream",
        "predictions": "text/csv",
        "report": "text/markdown",
        "cleaned": "text/csv",
    }.get(kind, "application/octet-stream")
    return FileResponse(file_path, media_type=media, filename=f"{run_id}_{kind}{file_path.suffix}")


@router.get("/runs")
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
                except Exception as exc:  # noqa: BLE001 - skip corrupt results
                    logger.warning("Skipping unreadable result %s: %s", result_path, exc)
    results.sort(key=lambda r: r.created_at, reverse=True)
    return results


@router.get("/run/{run_id}/stream")
async def run_stream(run_id: str) -> StreamingResponse:
    meta = _runs.get(run_id)
    if meta is None:
        body = f"data: {json.dumps({'type': 'error', 'message': 'Run not found.'})}\n\n"
        return StreamingResponse(iter([body]), media_type="text/event-stream")
    if not meta.target:
        body = f"data: {json.dumps({'type': 'error', 'message': 'No target selected for this run.'})}\n\n"
        return StreamingResponse(iter([body]), media_type="text/event-stream")

    queue: asyncio.Queue[dict] = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def emit(event: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, event)

    async def _train() -> None:
        try:
            await asyncio.to_thread(
                train_and_compare,
                run_id,
                meta.dataset_id,
                meta.target,
                meta.run_dir,
                emit,
            )
        except Exception as exc:  # noqa: BLE001 - report training failure to the user
            logger.exception("Training failed for %s", run_id)
            emit({"type": "error", "message": f"Training failed: {exc}"})

    task = asyncio.create_task(_train())

    async def event_gen():
        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event["type"] in ("result", "done", "error"):
                    break
        finally:
            await task

    return StreamingResponse(event_gen(), media_type="text/event-stream")
