from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Awaitable, Callable, Dict, Optional

from services.common.service import AsyncService
from services.common.schemas import Fill, OrderAck, OrderRequest, Position, OkResponse
from services.common.event_bus import GLOBAL_BUS
from .guardrails import GuardrailConfig, GuardrailEngine


@dataclass
class PendingOrder:
    symbol: str
    order: OrderRequest
    submitted_at: datetime


@dataclass
class SubmitTask:
    symbol: str
    order: OrderRequest
    future: asyncio.Future[OrderAck]


@dataclass
class BrokerConfig:
    paper_endpoint: str = "http://127.0.0.1:5000"
    live_endpoint: str = "http://127.0.0.1:5001"
    topic_orders: str = "broker.orders"
    topic_fills: str = "broker.fills"
    topic_positions: str = "broker.positions"
    topic_guardrails: str = "broker.guardrails"
    tick_topic: str = "ticks"
    trading_enabled: bool = True


class BrokerService(AsyncService):
    def __init__(self, config: BrokerConfig, guardrails: GuardrailConfig | None = None) -> None:
        super().__init__("broker")
        self.config = config
        self.guardrail_engine = GuardrailEngine(guardrails or GuardrailConfig())
        self._orders: Dict[str, PendingOrder] = {}
        self._positions: Dict[str, Position] = {}
        self._queue: asyncio.Queue[SubmitTask] = asyncio.Queue()
        self._last_mid: Dict[str, float] = {}
        self._tick_handler: Optional[Callable[[dict], Awaitable[None]]] = None
        self._pnl: Dict[str, float] = {}

    async def on_start(self) -> None:
        self.log.info("broker ready (trading_enabled=%s)", self.config.trading_enabled)
        async def handle_tick(payload: dict) -> None:
            symbol = payload.get("symbol")
            if not symbol:
                return
            spread = payload.get("spreadBp") or payload.get("spread_bp")
            mid = payload.get("mid")
            if isinstance(mid, (int, float)):
                self._last_mid[symbol] = float(mid)
            if isinstance(spread, (int, float)):
                self.guardrail_engine.update_spread(symbol, float(spread))

        self._tick_handler = handle_tick
        await GLOBAL_BUS.subscribe(self.config.tick_topic, handle_tick)

    async def on_stop(self) -> None:
        while not self._queue.empty():
            task = self._queue.get_nowait()
            if not task.future.done():
                task.future.set_exception(RuntimeError("broker stopping"))
        if self._tick_handler:
            await GLOBAL_BUS.unsubscribe(self.config.tick_topic, self._tick_handler)
            self._tick_handler = None
        self._orders.clear()

    async def step(self) -> None:
        task = await self._queue.get()
        symbol, order, future = task.symbol, task.order, task.future
        if not self.config.trading_enabled:
            self.log.warning("order blocked (trading disabled): %s", order)
            await self._emit_guardrail(symbol, order, "KILL", "Trading disabled")
            if not future.done():
                future.set_exception(RuntimeError("trading disabled"))
            self._queue.task_done()
            return

        guardrail = self.guardrail_engine.evaluate(symbol, order)
        if guardrail:
            self.log.warning("order blocked by %s: %s", guardrail, order)
            await self._emit_guardrail(symbol, order, guardrail, self._reason_text(guardrail, symbol))
            await GLOBAL_BUS.publish(
                self.config.topic_orders,
                {"status": "blocked", "reason": guardrail, "order": order.dict(), "symbol": symbol},
            )
            if not future.done():
                future.set_exception(RuntimeError(f"order blocked by {guardrail}"))
            self._queue.task_done()
            return

        order_id = str(uuid.uuid4())
        pending = PendingOrder(symbol=symbol, order=order, submitted_at=datetime.now(timezone.utc))
        self._orders[order_id] = pending
        ack = OrderAck(order_id=order_id)
        await GLOBAL_BUS.publish(
            self.config.topic_orders,
            {"status": "accepted", "orderId": ack.order_id, "order": order.dict(), "symbol": symbol},
        )
        self.log.info("order accepted %s -> %s", symbol, ack.order_id)
        if not future.done():
            future.set_result(ack)

        # for now simulate instant fill
        px = order.price or self._last_mid.get(symbol) or 0.0
        fill = Fill(
            order_id=order_id,
            symbol=symbol,
            ts=datetime.now(timezone.utc),
            px=px,
            qty=order.qty if order.side == "BUY" else -order.qty,
            kind="paper",
            venue="SIM",
        )
        await GLOBAL_BUS.publish(self.config.topic_fills, fill.dict(by_alias=True))
        pending_meta = self._orders.pop(order_id, None)
        latency_ms = self._record_latency(symbol, pending_meta)
        realized, pos = self._apply_fill(symbol, fill)
        self.guardrail_engine.update_latency(symbol, latency_ms)
        total_pnl = self._pnl.get(symbol, 0.0) + realized
        self._pnl[symbol] = total_pnl
        self.guardrail_engine.update_pnl(symbol, total_pnl)
        await GLOBAL_BUS.publish(self.config.topic_positions, pos.dict(by_alias=True))
        self.guardrail_engine.update_position(symbol, pos.qty, pos.avg_px)
        self._queue.task_done()

    async def place(self, symbol: str, order: OrderRequest) -> OrderAck:
        future: asyncio.Future[OrderAck] = self.loop.create_future()
        await self._queue.put(SubmitTask(symbol=symbol, order=order, future=future))
        return await future

    async def cancel(self, order_id: str) -> OkResponse:
        # TODO: integrate with real endpoint
        self.log.info("cancel requested for %s", order_id)
        return OkResponse()

    async def flatten(self, symbol: str) -> OkResponse:
        pos = self._positions.get(symbol)
        if not pos or pos.qty == 0:
            return OkResponse()
        side = "SELL" if pos.qty > 0 else "BUY"
        await self.place(symbol, OrderRequest(side=side, qty=abs(pos.qty), type="MKT"))
        return OkResponse()

    async def flatten_all(self) -> OkResponse:
        symbols = [symbol for symbol, pos in self._positions.items() if pos.qty]
        for symbol in symbols:
            await self.flatten(symbol)
        return OkResponse()

    async def _emit_guardrail(self, symbol: str, order: OrderRequest, rule: str, message: str) -> None:
        payload = {
            "rule": rule,
            "message": message,
            "symbol": symbol,
            "order": order.dict(),
            "severity": "block",
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        await GLOBAL_BUS.publish(self.config.topic_guardrails, payload)

    def _reason_text(self, reason: str, symbol: str) -> str:
        state = self.guardrail_engine.state_by_symbol.get(symbol)
        if reason == "SPREAD":
            spread = state.last_spread_bp if state else None
            return (
                f"Spread {spread:.2f}bp exceeds limit"
                if spread is not None
                else "Spread exceeds limit"
            )
        if reason == "POS":
            current = state.current_pos if state else 0.0
            return f"Position limit hit (current {current})"
        if reason == "COOLDOWN":
            return "Cooldown in effect"
        if reason == "LATENCY":
            return "Latency above limit"
        if reason == "DD":
            return "Drawdown limit breached"
        if reason == "KILL":
            return "Trading disabled"
        return f"Blocked by {reason}"

    def _record_latency(self, symbol: str, pending: Optional[PendingOrder]) -> float:
        if not pending:
            return 0.0
        latency = (datetime.now(timezone.utc) - pending.submitted_at).total_seconds() * 1000
        return float(max(latency, 0.0))

    def _apply_fill(self, symbol: str, fill: Fill) -> tuple[float, Position]:
        pos = self._positions.get(symbol)
        if not pos:
            pos = Position(symbol=symbol, qty=0.0, avg_px=fill.px or 0.0)

        qty_before = pos.qty
        avg_before = pos.avg_px
        qty_after = qty_before + fill.qty

        realized = 0.0
        avg_after = avg_before

        if qty_before == 0:
            avg_after = fill.px
        elif qty_before > 0 and fill.qty < 0:
            closing = min(qty_before, -fill.qty)
            realized = (fill.px - avg_before) * closing
            if qty_after > 0:
                avg_after = avg_before
            elif qty_after < 0:
                avg_after = fill.px
            else:
                avg_after = 0.0
        elif qty_before < 0 and fill.qty > 0:
            closing = min(-qty_before, fill.qty)
            realized = (avg_before - fill.px) * closing
            if qty_after < 0:
                avg_after = avg_before
            elif qty_after > 0:
                avg_after = fill.px
            else:
                avg_after = 0.0
        else:
            if qty_after != 0:
                avg_after = (avg_before * qty_before + fill.px * fill.qty) / qty_after
            else:
                avg_after = 0.0

        pos.qty = qty_after
        pos.avg_px = avg_after if qty_after != 0 else 0.0
        self._positions[symbol] = pos
        return realized, pos
