from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Awaitable, Callable, Optional

import httpx

from services.common.event_bus import GLOBAL_BUS
from services.common.service import AsyncService


@dataclass
class NextBridgeConfig:
    base_url: str = "http://127.0.0.1:3000"
    ingest_path: str = "/api/ingest"
    fill_path: str = "/api/fill"
    guardrail_path: str = "/api/guardrail"
    ingest_key: Optional[str] = None
    tick_topic: str = "ticks"
    fill_topic: str = "broker.fills"
    guardrail_topic: str = "broker.guardrails"


class NextBridgeService(AsyncService):
    def __init__(self, config: NextBridgeConfig) -> None:
        super().__init__("reports")
        self.cfg = config
        self.client: Optional[httpx.AsyncClient] = None
        self._subscriptions: list[tuple[str, Callable[[dict], Awaitable[None]]]] = []
        self._post_failures: int = 0
        self._next_failure_log: float = 0.0

    async def on_start(self) -> None:
        headers = {"User-Agent": "l2dash-bridge/0.1"}
        if self.cfg.ingest_key:
            headers["x-ingest-key"] = self.cfg.ingest_key
        transport = httpx.AsyncHTTPTransport(retries=2)
        self.client = httpx.AsyncClient(
            base_url=self.cfg.base_url,
            headers=headers,
            timeout=httpx.Timeout(5.0, connect=3.0),
            transport=transport,
        )
        await GLOBAL_BUS.subscribe(self.cfg.tick_topic, self._on_tick)
        await GLOBAL_BUS.subscribe(self.cfg.fill_topic, self._on_fill)
        await GLOBAL_BUS.subscribe(self.cfg.guardrail_topic, self._on_guardrail)
        self._subscriptions = [
            (self.cfg.tick_topic, self._on_tick),
            (self.cfg.fill_topic, self._on_fill),
            (self.cfg.guardrail_topic, self._on_guardrail),
        ]
        self.log.info("Next.js bridge ready base_url=%s", self.cfg.base_url)

    async def on_stop(self) -> None:
        for topic, handler in self._subscriptions:
            await GLOBAL_BUS.unsubscribe(topic, handler)
        self._subscriptions.clear()
        if self.client:
            await self.client.aclose()
            self.client = None

    async def step(self) -> None:
        await asyncio.sleep(1)

    async def _post(self, path: str, payload: dict) -> None:
        if not self.client:
            return
        try:
            response = await self.client.post(path, json=payload)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            self._log_post_failure(path, exc)
        except httpx.RequestError as exc:
            self._log_post_failure(path, exc)
        else:
            if self._post_failures:
                self.log.info(
                    "bridge POST %s recovered after %d failure%s",
                    path,
                    self._post_failures,
                    "s" if self._post_failures != 1 else "",
                )
            self._post_failures = 0
            self._next_failure_log = 0.0

    async def _on_tick(self, payload: dict) -> None:
        try:
            symbol = payload.get("symbol")
            mid = float(payload.get("mid", 0.0))
            ts = payload.get("ts")
            if isinstance(ts, str):
                ts_dt = datetime.fromisoformat(ts)
            elif isinstance(ts, (int, float)):
                ts_dt = datetime.fromtimestamp(float(ts), tz=timezone.utc)
            elif isinstance(ts, datetime):
                ts_dt = ts
            else:
                ts_dt = datetime.now(timezone.utc)
            ms = int(ts_dt.timestamp() * 1000)
            ingest_payload = {"symbol": symbol, "price": mid, "ts": ms}
            await self._post(self.cfg.ingest_path, ingest_payload)
        except Exception as exc:
            self.log.error("tick bridge error: %s", exc)

    async def _on_fill(self, payload: dict) -> None:
        try:
            order_id = payload.get("order_id") or payload.get("orderId")
            px = float(payload.get("px", 0.0))
            qty = float(payload.get("qty", 0.0))
            symbol = payload.get("symbol") or payload.get("Symbol")
            if not symbol:
                self.log.debug("ignoring fill without symbol: %s", payload)
                return
            kind = payload.get("kind") or payload.get("Kind")
            fill_payload = {"orderId": order_id or "unknown", "px": px, "qty": qty, "symbol": symbol, "kind": kind}
            await self._post(self.cfg.fill_path, fill_payload)
        except Exception as exc:
            self.log.error("fill bridge error: %s", exc)

    async def _on_guardrail(self, payload: dict) -> None:
        try:
            event = {
                "rule": payload.get("rule") or payload.get("reason") or "UNKNOWN",
                "message": payload.get("message") or "",
                "symbol": payload.get("symbol"),
                "severity": payload.get("severity", "warn"),
                "ts": payload.get("ts"),
            }
            await self._post(self.cfg.guardrail_path, event)
        except Exception as exc:
            self.log.error("guardrail bridge error: %s", exc)

    def _log_post_failure(self, path: str, exc: Exception) -> None:
        self._post_failures += 1
        loop = asyncio.get_running_loop()
        now = loop.time()
        if now >= self._next_failure_log:
            self.log.warning(
                "bridge POST %s failed (%d attempt%s): %s",
                path,
                self._post_failures,
                "s" if self._post_failures != 1 else "",
                exc,
            )
            backoff = min(60.0, 2 ** min(self._post_failures, 5))
            self._next_failure_log = now + backoff
