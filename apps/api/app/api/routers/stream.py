import asyncio
import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.ml import train_and_compare
from app.core.run_store import find_run_dir, read_run_meta
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["runs"])


@router.get("/runs/{run_id}/stream")
async def run_stream(run_id: str) -> StreamingResponse:
    run_dir = find_run_dir(run_id)
    if run_dir is None:
        raise HTTPException(status_code=404, detail="Run not found.")

    meta = read_run_meta(run_dir)
    if meta is None:
        raise HTTPException(status_code=400, detail="Run metadata not found; run may not have been initialised.")
    if not meta.get("target"):
        raise HTTPException(status_code=400, detail="No target selected for this run.")

    queue: asyncio.Queue[dict] = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def emit(event: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, event)

    async def _train() -> None:
        try:
            await asyncio.to_thread(
                train_and_compare,
                run_id,
                meta["dataset_id"],
                meta["target"],
                run_dir,
                emit,
            )
        except Exception as exc:
            logger.exception("Training failed for %s", run_id)
            emit({"type": "error", "message": f"Training failed: {exc}"})

    task = asyncio.create_task(_train())

    async def event_gen():
        try:
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
                if event["type"] in ("result", "error"):
                    break
        finally:
            await task

    return StreamingResponse(event_gen(), media_type="text/event-stream")
