import asyncio
import time

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.schemas.run import DoneEvent, RunResponse, StepEvent

router = APIRouter()


def _new_run_id() -> str:
    # Stable-enough id for M0; replaced with UUID once uploads land (M1).
    return f"run_{int(time.time() * 1000)}"


@router.post("/run")
def create_run() -> RunResponse:
    return RunResponse(run_id=_new_run_id())


@router.get("/run/{run_id}/stream")
async def run_stream(run_id: str) -> StreamingResponse:
    async def event_gen():
        steps = [
            ("ingest", "Reading your CSV into memory and validating columns…", 25),
            ("analyze", "Profiling data types, missing values, and correlations…", 60),
            ("prepare", "Pipeline steps are wired and ready for M1+…", 100),
        ]
        for name, explanation, pct in steps:
            await asyncio.sleep(0.15)
            yield f"data: {StepEvent(name=name, explanation=explanation, pct=pct).model_dump_json()}\n\n"
        yield f"data: {DoneEvent(message='M0 scaffold complete (no ML yet)').model_dump_json()}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")
