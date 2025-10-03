from __future__ import annotations

import httpx
from pydantic import BaseModel
from typing import List


class InferRequest(BaseModel):
    symbol: str
    features: List[float]
    ts: float


class InferResponse(BaseModel):
    state: int
    probs: List[float]
    action: str | None = None
    confidence: float = 0.0


class HMMClient:
    def __init__(self, base_url: str = "http://127.0.0.1:8000") -> None:
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url)

    async def infer(self, symbol: str, features: List[float], ts: float) -> InferResponse:
        payload = {"symbol": symbol, "features": features, "ts": ts}
        resp = await self.client.post("/infer", json=payload)
        resp.raise_for_status()
        return InferResponse.parse_obj(resp.json())

    def fallback(self) -> InferResponse:
        probs = [1 / 3, 1 / 3, 1 / 3]
        return InferResponse(state=1, probs=probs, action=None, confidence=max(probs))
