from __future__ import annotations

from collections import deque
from typing import Deque, Dict, Iterable, List, Sequence, Tuple

import math


def mid_price(best_bid: float, best_ask: float) -> float:
    return (best_bid + best_ask) / 2.0


def spread_bp(best_bid: float, best_ask: float) -> float:
    mid = mid_price(best_bid, best_ask)
    if mid == 0:
        return 0.0
    return ((best_ask - best_bid) / mid) * 10_000


def order_flow_imbalance(prev_bid: float, prev_ask: float, bids: Sequence[Tuple[float, float]], asks: Sequence[Tuple[float, float]]) -> float:
    bid_vol = sum(sz for _, sz in bids)
    ask_vol = sum(sz for _, sz in asks)
    total = bid_vol + ask_vol
    if total == 0:
        return 0.0
    return (bid_vol - ask_vol) / total


def microprice(bids: Sequence[Tuple[float, float]], asks: Sequence[Tuple[float, float]]) -> float:
    if not bids or not asks:
        return 0.0
    bid_px, bid_sz = bids[0]
    ask_px, ask_sz = asks[0]
    total = bid_sz + ask_sz
    if total == 0:
        return mid_price(bid_px, ask_px)
    return (ask_px * bid_sz + bid_px * ask_sz) / total


def rolling_volatility(prices: Iterable[float]) -> float:
    prices = list(prices)
    if len(prices) < 2:
        return 0.0
    mean = sum(prices) / len(prices)
    var = sum((p - mean) ** 2 for p in prices) / (len(prices) - 1)
    return var ** 0.5


class FeatureStandardizer:
    """Maintain rolling statistics per symbol to z-score feature vectors."""

    def __init__(self, window: int = 30) -> None:
        self.window = max(2, int(window or 0))
        self.history: Dict[str, List[Deque[float]]] = {}

    def _ensure_history(self, symbol: str, dimensions: int) -> List[Deque[float]]:
        buckets = self.history.get(symbol)
        if buckets is None or len(buckets) != dimensions:
            buckets = [deque(maxlen=self.window) for _ in range(dimensions)]
            self.history[symbol] = buckets
        return buckets

    def transform(self, symbol: str, vector: Sequence[float]) -> List[float]:
        if not vector:
            return []
        buckets = self._ensure_history(symbol, len(vector))
        standardized: List[float] = []
        for idx, value in enumerate(vector):
            safe_value = float(value) if math.isfinite(value) else 0.0
            bucket = buckets[idx]
            bucket.append(safe_value)
            if len(bucket) < 2:
                standardized.append(0.0)
                continue
            mean = sum(bucket) / len(bucket)
            variance = sum((x - mean) ** 2 for x in bucket) / len(bucket)
            std = math.sqrt(variance)
            if std <= 1e-9:
                standardized.append(0.0)
            else:
                standardized.append((safe_value - mean) / std)
        return standardized

