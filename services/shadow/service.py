from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import List, Tuple

from services.common.service import AsyncService
from services.common.event_bus import GLOBAL_BUS
from services.common.schemas import Fill
from .simulator import QueueAwareSimulator, ShadowOrder


@dataclass
class ShadowConfig:
    topic_book: str = "ticks.book"
    topic_trades: str = "ticks.trades"
    topic_orders: str = "broker.orders"
    topic_fills: str = "broker.fills"
    topic_shadow_fills: str = "shadow.fills"


class ShadowService(AsyncService):
    def __init__(self, config: ShadowConfig) -> None:
        super().__init__("shadow")
        self.config = config
        self.sim = QueueAwareSimulator()
        self._queue: asyncio.Queue[tuple[str, dict]] = asyncio.Queue()
        self._tasks: List[asyncio.Task] = []

    async def on_start(self) -> None:
        async def handler(payload: dict) -> None:
            await self._queue.put(("generic", payload))

        await GLOBAL_BUS.subscribe(self.config.topic_orders, self._enqueue_order)
        await GLOBAL_BUS.subscribe(self.config.topic_book, self._on_book)
        await GLOBAL_BUS.subscribe(self.config.topic_trades, self._on_trade)
        self.log.info("shadow service subscribed to topics")

    async def on_stop(self) -> None:
        while not self._queue.empty():
            self._queue.get_nowait()

    async def step(self) -> None:
        # Process book/trade updates opportunistically
        await asyncio.sleep(0.01)

    async def _enqueue_order(self, payload: dict) -> None:
        status = payload.get("status")
        if status != "accepted":
            return
        order_id = payload.get("orderId", "")
        order = payload.get("order")
        if not order:
            return
        if order.get("type") != "LMT" or "price" not in order:
            return
        self.sim.place_limit(ShadowOrder(
            order_id=order_id,
            side=order["side"],
            price=order.get("price", 0.0),
            qty=order["qty"],
            ts=asyncio.get_running_loop().time(),
        ))

    async def _on_book(self, payload: dict) -> None:
        bids = payload.get("bids", [])
        asks = payload.get("asks", [])
        self.sim.on_book(bids, asks)

    async def _on_trade(self, payload: dict) -> None:
        self.sim.on_trade(payload.get("price", 0.0), payload.get("size", 0.0), payload.get("aggressor", "BUY"))
        fills = self.sim.try_fills(asyncio.get_running_loop().time())
        for fill in fills:
            symbol = payload.get("symbol") or "UNKNOWN"
            await GLOBAL_BUS.publish(
                self.config.topic_shadow_fills,
                Fill(
                    order_id=fill.order_id,
                    symbol=symbol,
                    ts=payload.get("ts"),
                    px=fill.avg_px,
                    qty=fill.qty,
                    kind="shadow",
                    venue="SIM",
                ).dict(by_alias=True),
            )
