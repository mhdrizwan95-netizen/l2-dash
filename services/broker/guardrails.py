from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional

from services.common.schemas import OrderRequest


@dataclass
class GuardrailState:
    current_pos: float = 0.0
    last_flip_ts: Optional[datetime] = None
    intraday_pnl: float = 0.0
    last_spread_bp: Optional[float] = None
    latency_ms: float = 0.0


@dataclass
class GuardrailConfig:
    max_spread_bp: float = 50
    max_position: float = 100
    cooldown_ms: int = 5_000
    latency_ms_limit: int = 1_000
    max_drawdown: float = 5_000


class GuardrailEngine:
    def __init__(self, cfg: GuardrailConfig) -> None:
        self.cfg = cfg
        self.state_by_symbol: Dict[str, GuardrailState] = {}

    def evaluate(self, symbol: str, order: OrderRequest) -> Optional[str]:
        state = self.state_by_symbol.setdefault(symbol, GuardrailState())
        if state.last_spread_bp is not None and state.last_spread_bp > self.cfg.max_spread_bp:
            return "SPREAD"
        proposed = state.current_pos + (order.qty if order.side == "BUY" else -order.qty)
        if abs(proposed) > self.cfg.max_position:
            return "POS"
        if state.last_flip_ts:
            delta_ms = (datetime.utcnow() - state.last_flip_ts).total_seconds() * 1000
            if delta_ms < self.cfg.cooldown_ms:
                return "COOLDOWN"
        if state.latency_ms > self.cfg.latency_ms_limit:
            return "LATENCY"
        if state.intraday_pnl < -self.cfg.max_drawdown:
            return "DD"
        return None

    def update_spread(self, symbol: str, spread_bp: float) -> None:
        state = self.state_by_symbol.setdefault(symbol, GuardrailState())
        state.last_spread_bp = spread_bp

    def update_position(self, symbol: str, qty: float, avg_px: float) -> None:
        state = self.state_by_symbol.setdefault(symbol, GuardrailState())
        prev = state.current_pos
        state.current_pos = qty
        if prev == 0 or qty == 0:
            state.last_flip_ts = datetime.utcnow()
        elif (prev > 0 and qty < 0) or (prev < 0 and qty > 0):
            state.last_flip_ts = datetime.utcnow()

    def update_latency(self, symbol: str, latency_ms: float) -> None:
        state = self.state_by_symbol.setdefault(symbol, GuardrailState())
        state.latency_ms = latency_ms

    def update_pnl(self, symbol: str, intraday_pnl: float) -> None:
        state = self.state_by_symbol.setdefault(symbol, GuardrailState())
        state.intraday_pnl = intraday_pnl
