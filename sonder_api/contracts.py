from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RequestModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class StartRequest(RequestModel):
    unit_id: str = Field(min_length=1, max_length=32)
    create_request_id: str = Field(min_length=36, max_length=36, pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


class AnswerRequest(RequestModel):
    step_index: int = Field(ge=0, le=1000)
    item_id: str = Field(min_length=1, max_length=64)
    option_id: Literal["A", "B", "C", "D"]
