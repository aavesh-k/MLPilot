from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.run_store import find_run_dir, load_result

router = APIRouter(tags=["runs"])

ArtifactKind = Literal["model", "predictions", "report", "cleaned", "pdf"]

MEDIA_TYPES: dict[str, str] = {
    "model": "application/octet-stream",
    "predictions": "text/csv",
    "report": "text/markdown",
    "cleaned": "text/csv",
    "pdf": "application/pdf",
}


@router.get("/runs/{run_id}/download/{kind}")
def download_artifact(run_id: str, kind: ArtifactKind) -> FileResponse:
    run_dir = find_run_dir(run_id)
    if run_dir is None:
        raise HTTPException(status_code=404, detail="Run not found.")
    result = load_result(run_id)
    if result is None or kind not in result.artifacts:
        raise HTTPException(status_code=404, detail=f"Artifact '{kind}' not available.")

    file_path = run_dir / result.artifacts[kind]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Artifact file missing.")

    media_type = MEDIA_TYPES.get(kind, "application/octet-stream")
    return FileResponse(file_path, media_type=media_type, filename=f"{run_id}_{kind}{file_path.suffix}")
