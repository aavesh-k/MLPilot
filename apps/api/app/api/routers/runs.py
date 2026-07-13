from pydantic import BaseModel

from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.run_store import find_run_dir, load_result, list_runs as list_stored_runs, new_run_id, write_run_meta
from app.schemas.run import RunResult

router = APIRouter(tags=["runs"])


class CreateRunRequest(BaseModel):
    dataset_id: str
    target: str


class RunResponse(BaseModel):
    run_id: str


@router.post("/runs", response_model=RunResponse)
def create_run(body: CreateRunRequest) -> RunResponse:
    dataset_path = settings.runs_dir / body.dataset_id / "raw.csv"
    if not dataset_path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset '{body.dataset_id}' not found.")

    run_id = new_run_id()
    run_dir = settings.runs_dir / body.dataset_id / run_id
    write_run_meta(run_dir, body.dataset_id, body.target)
    return RunResponse(run_id=run_id)


@router.get("/runs")
def list_runs() -> list[RunResult]:
    return list_stored_runs()


@router.get("/runs/{run_id}/result")
def get_result(run_id: str):
    result = load_result(run_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Run result not ready or not found.")
    return result
