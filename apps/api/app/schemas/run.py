from typing import Literal

from pydantic import BaseModel


class RunResponse(BaseModel):
    run_id: str


class StepEvent(BaseModel):
    type: Literal["step"] = "step"
    name: str
    explanation: str
    pct: int


class DoneEvent(BaseModel):
    type: Literal["done"] = "done"
    message: str = "pipeline complete"


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str
