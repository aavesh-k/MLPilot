import json
import uuid

import pandas as pd
from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import settings
from app.core.io import dataset_path
from app.core.profiling import build_profile
from app.schemas.dataset import ColumnInfo, DatasetResponse
from app.schemas.profile import ProfileResponse

router = APIRouter(tags=["datasets"])

# M1 preview cap. The full V1 target is ~200 MB, but reading that fully into
# memory just to preview is risky on a single machine; raise once streaming
# preview lands.
MAX_UPLOAD_BYTES = 100 * 1024 * 1024


@router.post("/datasets", response_model=DatasetResponse)
async def upload_dataset(file: UploadFile = File(...)) -> DatasetResponse:
    filename = file.filename or "dataset.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are supported in M1.")

    dataset_id = uuid.uuid4().hex
    run_dir = settings.runs_dir / dataset_id
    run_dir.mkdir(parents=True, exist_ok=True)
    raw_path = run_dir / "raw.csv"

    size = 0
    with open(raw_path, "wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                raw_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large for preview (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB in M1).",
                )
            out.write(chunk)

    if size == 0:
        raw_path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        df = pd.read_csv(raw_path)
    except Exception as exc:
        raw_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="Could not parse CSV. Ensure the file is valid UTF-8 with a header row.")

    if df.shape[1] == 0:
        raw_path.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail="CSV has no columns.")

    columns = [
        ColumnInfo(name=str(col), dtype=str(df[col].dtype), nulls=int(df[col].isna().sum()))
        for col in df.columns
    ]

    # to_json handles NaN -> null and datetime -> ISO, giving JSON-safe records.
    preview_records = json.loads(df.head(50).to_json(orient="records", date_format="iso"))

    meta = {
        "id": dataset_id,
        "filename": filename,
        "size_bytes": size,
        "n_rows": int(df.shape[0]),
        "n_cols": int(df.shape[1]),
        "columns": [c.model_dump() for c in columns],
    }
    (run_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    return DatasetResponse(
        id=dataset_id,
        filename=filename,
        size_bytes=size,
        n_rows=int(df.shape[0]),
        n_cols=int(df.shape[1]),
        columns=columns,
        preview=preview_records,
    )


@router.get("/datasets/{dataset_id}/profile", response_model=ProfileResponse)
def profile_dataset(dataset_id: str) -> ProfileResponse:
    """Compute an on-demand statistical profile of a stored dataset."""
    ds_path = dataset_path(dataset_id)
    if not ds_path.exists():
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")
    try:
        return build_profile(dataset_id)
    except Exception as exc:
        logger = __import__("logging").getLogger(__name__)
        logger.exception("Failed to profile dataset %s", dataset_id)
        raise HTTPException(status_code=422, detail=str(exc))
