from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple


Side = str


@dataclass
class ShadowOrder:
    order_id: str
    side: Side
    price: float
    qty: float
    ts: float


@dataclass
class ShadowFill:
    order_id: str
    ts: float
    avg_px: float
    qty: float


class QueueAwareSimulator:
    def __init__(self) -> None:
        self.latency_ms: int = 60
        self.orders: Dict[str, ShadowOrder] = {}
        self.queue_ahead: Dict[Side, Dict[float, float]] = {"BUY": {}, "SELL": {}}
        self.exec_since: Dict[Side, Dict[float, float]] = {"BUY": {}, "SELL": {}}
        self.latest_bids: List[Tuple[float, float]] = []
        self.latest_asks: List[Tuple[float, float]] = []

    def on_book(self, bids: List[Tuple[float, float]], asks: List[Tuple[float, float]]) -> None:
        self.latest_bids = bids
        self.latest_asks = asks

    def on_trade(self, price: float, size: float, aggressor: Side) -> None:
        side_hit: Side = "SELL" if aggressor == "BUY" else "BUY"
        book = self.exec_since[side_hit]
        book[price] = book.get(price, 0.0) + size

    def place_limit(self, order: ShadowOrder) -> None:
        self.orders[order.order_id] = order
        qa = self.queue_ahead[order.side]
        qa[order.price] = qa.get(order.price, 0.0) + self.displayed_size(order.side, order.price)

    def cancel(self, order_id: str) -> None:
        self.orders.pop(order_id, None)

    def try_fills(self, now: float) -> List[ShadowFill]:
        fills: List[ShadowFill] = []
        for order_id, order in list(self.orders.items()):
            if (now - order.ts) * 1000 < self.latency_ms:
                continue
            execd = self.exec_since[order.side].get(order.price, 0.0)
            ahead = self.queue_ahead[order.side].get(order.price, 0.0)
            available = execd - ahead
            if available <= 0:
                continue
            qty = min(available, order.qty)
            fills.append(ShadowFill(order_id=order_id, ts=now, avg_px=order.price, qty=qty))
            self.orders.pop(order_id, None)
        return fills

    def displayed_size(self, side: Side, price: float) -> float:
        book = self.latest_bids if side == "BUY" else self.latest_asks
        for px, sz in book:
            if abs(px - price) < 1e-9:
                return sz
        return 0.0

