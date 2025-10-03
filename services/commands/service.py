from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from services.broker.service import BrokerService
from services.common.service import AsyncService


@dataclass
class CommandConfig:
    commands_dir: Path = Path("sessions/commands")
    processed_dir: Path | None = None
    poll_interval: float = 1.0


class CommandService(AsyncService):
    def __init__(self, config: CommandConfig, broker: BrokerService) -> None:
        super().__init__("command")
        self.cfg = config
        self.broker = broker
        self.cfg.processed_dir = self.cfg.processed_dir or (self.cfg.commands_dir / "processed")

    async def on_start(self) -> None:
        self.cfg.commands_dir.mkdir(parents=True, exist_ok=True)
        if self.cfg.processed_dir:
            self.cfg.processed_dir.mkdir(parents=True, exist_ok=True)
        self.log.info("command service watching %s", self.cfg.commands_dir)

    async def on_stop(self) -> None:
        # nothing to clean up beyond run loop
        return

    async def step(self) -> None:
        await asyncio.sleep(self.cfg.poll_interval)
        await self._process_commands()

    async def _process_commands(self) -> None:
        try:
            files = sorted(self.cfg.commands_dir.glob("*.json"))
        except OSError as exc:
            self.log.error("command directory error: %s", exc)
            return
        for path in files:
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except Exception as exc:
                self.log.error("invalid command file %s: %s", path.name, exc)
                self._mark_processed(path, success=False)
                continue
            await self._dispatch(path, payload)

    async def _dispatch(self, path: Path, payload: dict[str, Any]) -> None:
        command = str(payload.get("command", "")).lower()
        try:
            if command == "flatten_all":
                await self.broker.flatten_all()
                self.log.info("executed flatten_all (file=%s)", path.name)
            elif command == "flatten_symbol":
                symbol = str(payload.get("symbol", "")).upper()
                if not symbol:
                    raise ValueError("flatten_symbol missing symbol")
                await self.broker.flatten(symbol)
                self.log.info("executed flatten_symbol %s (file=%s)", symbol, path.name)
            else:
                raise ValueError(f"unknown command {command!r}")
            self._mark_processed(path, success=True)
        except Exception as exc:
            self.log.error("command %s failed: %s", command or path.name, exc)
            self._mark_processed(path, success=False)

    def _mark_processed(self, path: Path, success: bool) -> None:
        try:
            if not self.cfg.processed_dir:
                path.unlink(missing_ok=True)
                return
            target_dir = self.cfg.processed_dir / ("ok" if success else "failed")
            target_dir.mkdir(parents=True, exist_ok=True)
            target_path = target_dir / path.name
            path.replace(target_path)
        except OSError as exc:
            self.log.debug("unable to mark command %s processed: %s", path.name, exc)
