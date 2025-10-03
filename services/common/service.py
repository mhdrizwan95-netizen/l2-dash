"""Base class for long-running asyncio services."""
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Optional

from .logging import configure


class AsyncService(ABC):
    def __init__(self, name: str, loop: Optional[asyncio.AbstractEventLoop] = None) -> None:
        self.name = name
        self.loop = loop or asyncio.get_event_loop()
        self.log = configure(name)
        self._running = False

    async def start(self) -> None:
        if self._running:
            return
        self.log.info("starting service")
        self._running = True
        await self.on_start()

    async def stop(self) -> None:
        if not self._running:
            return
        self.log.info("stopping service")
        self._running = False
        await self.on_stop()

    async def run_forever(self) -> None:
        await self.start()
        try:
            while self._running:
                await self.step()
        finally:
            await self.stop()

    @abstractmethod
    async def on_start(self) -> None: ...

    @abstractmethod
    async def step(self) -> None: ...

    @abstractmethod
    async def on_stop(self) -> None: ...

