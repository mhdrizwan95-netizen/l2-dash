from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Awaitable, Callable, Dict, List, Optional

from services.common.service import AsyncService
from services.common.event_bus import GLOBAL_BUS
from services.common.schemas import Tick
from services.broker.service import BrokerService
from .hmm_client import HMMClient
from .policy import SimplePolicy, PolicyConfig


@dataclass
class AlgoConfig:
    symbols: List[str] = field(default_factory=list)
    tick_topic: str = "ticks"
    universe_topic: Optional[str] = "universe.active_symbols"
    hmm_url: str = "http://127.0.0.1:8000"


class AlgoService(AsyncService):
    def __init__(self, config: AlgoConfig, broker: BrokerService, policy_cfg: PolicyConfig | None = None) -> None:
        super().__init__("algo")
        self.config = config
        self.broker = broker
        self.hmm = HMMClient(config.hmm_url)
        self.policy = SimplePolicy(policy_cfg)
        self._queue: asyncio.Queue[Tick] = asyncio.Queue()
        self._active_symbols: Dict[str, bool] = {sym.upper(): True for sym in config.symbols}
        self._universe_handler: Optional[callable] = None
        self._tick_handler: Optional[Callable[[dict], Awaitable[None]]] = None

    async def on_start(self) -> None:
        async def handler(payload: dict) -> None:
            try:
                tick = Tick.parse_obj(payload)
            except Exception as exc:
                self.log.error("invalid tick payload: %s", exc)
                return
            if not self._should_trade(tick.symbol):
                return
            await self._queue.put(tick)

        await GLOBAL_BUS.subscribe(self.config.tick_topic, handler)
        self._tick_handler = handler
        self.log.info("algo subscribed to %s", self.config.tick_topic)
        self._universe_handler = None
        if self.config.universe_topic:
            async def handle_universe(payload: dict) -> None:
                self._update_universe(payload)

            self._universe_handler = handle_universe
            await GLOBAL_BUS.subscribe(self.config.universe_topic, handle_universe)
            self.log.info("algo subscribed to %s", self.config.universe_topic)

    async def on_stop(self) -> None:
        while not self._queue.empty():
            self._queue.get_nowait()
        if self._universe_handler and self.config.universe_topic:
            await GLOBAL_BUS.unsubscribe(self.config.universe_topic, self._universe_handler)
            self._universe_handler = None
        if self._tick_handler:
            await GLOBAL_BUS.unsubscribe(self.config.tick_topic, self._tick_handler)
            self._tick_handler = None

    async def step(self) -> None:
        tick = await self._queue.get()
        await self.handle_tick(tick)
        self._queue.task_done()

    async def handle_tick(self, tick: Tick) -> None:
        if not tick.features:
            return
        try:
            inference = await self.hmm.infer(tick.symbol, tick.features, tick.ts.timestamp())
        except Exception as exc:  # pragma: no cover
            self.log.warning("/infer failed: %s", exc)
            inference = self.hmm.fallback()
        order = self.policy.decide(tick.symbol, inference.probs, inference.confidence)
        if order:
            self.log.info("policy generated order %s", order)
            try:
                await self.broker.place(tick.symbol, order)
            except RuntimeError as exc:
                self.log.warning("order rejected: %s", exc)

    def _should_trade(self, symbol: str | None) -> bool:
        if not symbol:
            return False
        if not self._active_symbols:
            return not self.config.symbols or symbol.upper() in {s.upper() for s in self.config.symbols}
        return self._active_symbols.get(symbol.upper(), False)

    def _update_universe(self, payload: dict) -> None:
        active = payload.get("activeSymbols") or []
        next_map: Dict[str, bool] = {}
        if isinstance(active, list):
            for entry in active:
                try:
                    symbol = str(entry.get("symbol", "")).upper()
                except Exception:
                    continue
                if not symbol:
                    continue
                traded = bool(entry.get("traded", False))
                next_map[symbol] = traded
        if not next_map and self.config.symbols:
            next_map = {sym.upper(): True for sym in self.config.symbols}
        removed = set(self._active_symbols.keys()) - set(next_map.keys())
        added = set(next_map.keys()) - set(self._active_symbols.keys())
        if added or removed:
            self.log.info("universe update active=%s traded=%s", ",".join(sorted(next_map.keys())), [sym for sym, ok in next_map.items() if ok])
        self._active_symbols = next_map
