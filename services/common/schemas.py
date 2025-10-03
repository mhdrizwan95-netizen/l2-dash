"""Pydantic models for service contracts.

These mirror the interface definitions in the action plan so we have
centralized validation and serialization.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Literal


class Trade(BaseModel):
    px: float = Field(..., description="Trade price")
    size: float = Field(..., description="Trade size in shares/contracts")
    side: Literal["BUY", "SELL"]

    class Config:
        allow_population_by_field_name = True


class Tick(BaseModel):
    symbol: str
    ts: datetime
    mid: float
    spread_bp: float = Field(..., alias="spreadBp")
    imb: float
    depth: Optional[List[List[float]]] = None
    trades: Optional[List[Trade]] = None
    features: List[float]

    class Config:
        allow_population_by_field_name = True

    @validator("ts", pre=True)
    def _coerce_ts(cls, value: object) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        if isinstance(value, str):
            candidate = value
            if candidate.endswith("Z"):
                candidate = candidate[:-1] + "+00:00"
            try:
                return datetime.fromisoformat(candidate)
            except ValueError:
                pass
        raise ValueError("invalid timestamp for Tick.ts")

    def to_payload(self) -> dict:
        data = self.dict(by_alias=True)
        data["ts"] = self.ts.timestamp()
        return data


class HMMResponse(BaseModel):
    state: int
    probs: List[float]
    action: Optional[str] = None
    confidence: float = 0.0


class OrderRequest(BaseModel):
    side: Literal["BUY", "SELL"]
    qty: float
    type: Literal["MKT", "LMT"]
    price: Optional[float] = None
    tif: Optional[Literal["DAY", "IOC", "FOK"]] = None

    class Config:
        allow_population_by_field_name = True


class OrderAck(BaseModel):
    order_id: str = Field(..., alias="orderId")

    class Config:
        allow_population_by_field_name = True


class Fill(BaseModel):
    order_id: str = Field(..., alias="orderId")
    symbol: str
    ts: datetime
    px: float
    qty: float
    kind: Literal["paper", "live", "shadow"]
    venue: str = "IBKR"

    class Config:
        allow_population_by_field_name = True


class Position(BaseModel):
    symbol: str
    qty: float
    avg_px: float = Field(..., alias="avgPx")

    class Config:
        allow_population_by_field_name = True


class OkResponse(BaseModel):
    ok: bool = True

    class Config:
        allow_population_by_field_name = True


__all__ = [
    "Tick",
    "Trade",
    "HMMResponse",
    "OrderRequest",
    "OrderAck",
    "Fill",
    "Position",
    "OkResponse",
]
