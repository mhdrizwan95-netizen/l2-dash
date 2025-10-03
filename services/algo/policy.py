from __future__ import annotations

from dataclasses import dataclass
from typing import List, Literal, Optional

from services.common.schemas import OrderRequest

Action = Literal["BUY", "SELL", "FLAT"]


@dataclass
class PolicyConfig:
    base_qty: float = 10
    confidence_threshold: float = 0.55
    force_trade: bool = False
    alternate_sides: bool = True


class SimplePolicy:
    def __init__(self, config: PolicyConfig | None = None) -> None:
        self.cfg = config or PolicyConfig()
        self._last_side: Literal["BUY", "SELL"] = "SELL"

    def decide(self, symbol: str, probs: List[float], confidence: float) -> Optional[OrderRequest]:
        if self.cfg.force_trade:
            side = "BUY" if (self.cfg.alternate_sides and self._last_side == "SELL") else "SELL"
            self._last_side = side
            return OrderRequest(side=side, qty=self.cfg.base_qty, type="MKT")
        if confidence < self.cfg.confidence_threshold:
            return None
        up_prob = probs[2] if len(probs) > 2 else 0.0
        down_prob = probs[0] if probs else 0.0
        if up_prob - down_prob > 0.05:
            return OrderRequest(side="BUY", qty=self.cfg.base_qty, type="MKT")
        if down_prob - up_prob > 0.05:
            return OrderRequest(side="SELL", qty=self.cfg.base_qty, type="MKT")
        return None
