"""Async event bus shared across services.

The goal is to provide a lightweight publish/subscribe mechanism that can be
run in-process while leaving space to swap in Redis/Kafka later. Inspired by
QTPyLib's ZeroMQ bus, but simplified for asyncio.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Awaitable, Callable, Dict, List

EventHandler = Callable[[Any], Awaitable[None]]


class EventBus:
    def __init__(self) -> None:
        self._handlers: Dict[str, List[EventHandler]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def publish(self, topic: str, payload: Any) -> None:
        async with self._lock:
            handlers = list(self._handlers.get(topic, []))
        for handler in handlers:
            await handler(payload)

    async def subscribe(self, topic: str, handler: EventHandler) -> None:
        async with self._lock:
            self._handlers[topic].append(handler)

    async def unsubscribe(self, topic: str, handler: EventHandler) -> None:
        async with self._lock:
            handlers = self._handlers.get(topic, [])
            if handler in handlers:
                handlers.remove(handler)

    @asynccontextmanager
    async def subscription(self, topic: str, handler: EventHandler) -> AsyncGenerator[None, None]:
        await self.subscribe(topic, handler)
        try:
            yield
        finally:
            await self.unsubscribe(topic, handler)


GLOBAL_BUS = EventBus()

