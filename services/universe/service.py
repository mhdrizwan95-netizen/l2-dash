from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from services.common.event_bus import GLOBAL_BUS
from services.common.service import AsyncService

EASTERN = ZoneInfo("America/New_York")


@dataclass
class SymbolSnapshot:
    symbol: str
    dollar_volume: float = 0.0
    trades: int = 0
    spread_sum: float = 0.0
    spread_samples: int = 0
    last_seen: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict[str, Any]:
        avg_spread = self.spread_sum / self.spread_samples if self.spread_samples else 0.0
        return {
            "symbol": self.symbol,
            "dollarVolume": round(self.dollar_volume, 2),
            "totalTrades": int(self.trades),
            "avgSpreadBp": round(avg_spread, 3),
            "lastSeen": self.last_seen.isoformat(),
        }


@dataclass
class ScreenerConfig:
    tick_topic: str = "ticks"
    output_topic: str = "screener.today_top10"
    state_file: Path = Path("sessions/universe-state.json")
    max_symbols: int = 10


@dataclass
class UniverseConfig:
    screener_topic: str = "screener.today_top10"
    positions_topic: str = "broker.positions"
    output_topic: str = "universe.active_symbols"
    state_file: Path = Path("sessions/universe-state.json")
    model_dir: Path = Path("ml-service/models")
    max_symbols: int = 10
    churn_minutes: int = 15


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class ScreenerService(AsyncService):
    def __init__(self, config: ScreenerConfig) -> None:
        super().__init__("screener")
        self.cfg = config
        self._snapshots: Dict[str, SymbolSnapshot] = {}
        self._session_start: Optional[datetime] = None
        self._next_refresh_at: Optional[datetime] = None
        self._tick_handler = None
        self._state: Dict[str, Any] = {}
        self._state_dirty = False

    async def on_start(self) -> None:
        async def handler(payload: dict) -> None:
            await self._handle_tick(payload)

        self._tick_handler = handler
        await GLOBAL_BUS.subscribe(self.cfg.tick_topic, handler)
        self.log.info("screener subscribed to %s", self.cfg.tick_topic)

    async def on_stop(self) -> None:
        if self._tick_handler:
            await GLOBAL_BUS.unsubscribe(self.cfg.tick_topic, self._tick_handler)
            self._tick_handler = None
        self._snapshots.clear()

    async def step(self) -> None:
        await asyncio.sleep(1)
        now = _now_utc()
        if self._next_refresh_at and now >= self._next_refresh_at:
            await self._emit_refresh(now)
        if self._state_dirty:
            self._write_state()
            self._state_dirty = False

    async def _handle_tick(self, payload: dict) -> None:
        symbol = payload.get("symbol")
        if not symbol:
            return
        symbol = str(symbol).upper()
        ts_value = payload.get("ts")
        if isinstance(ts_value, str):
            try:
                ts = datetime.fromisoformat(ts_value)
            except ValueError:
                ts = _now_utc()
        elif isinstance(ts_value, (int, float)):
            ts = datetime.fromtimestamp(float(ts_value), tz=timezone.utc)
        elif isinstance(ts_value, datetime):
            ts = ts_value.astimezone(timezone.utc)
        else:
            ts = _now_utc()

        if self._session_start is None or ts.astimezone(EASTERN).date() != self._session_start.astimezone(EASTERN).date():
            self._reset_session(ts)

        snapshot = self._snapshots.setdefault(symbol, SymbolSnapshot(symbol=symbol))
        trades = payload.get("trades") or []
        dollar_volume = 0.0
        trade_count = 0
        if isinstance(trades, list):
            for trade in trades:
                try:
                    px = float(trade.get("px"))
                    qty = abs(float(trade.get("size")))
                except Exception:
                    continue
                if not (px > 0 and qty > 0):
                    continue
                dollar_volume += px * qty
                trade_count += 1
        # fall back to volume x mid if trades missing
        if dollar_volume == 0.0:
            mid = payload.get("mid")
            volume = payload.get("volume") or payload.get("qty")
            try:
                mid_f = float(mid)
                vol_f = abs(float(volume)) if volume is not None else 0.0
            except Exception:
                mid_f = 0.0
                vol_f = 0.0
            if mid_f > 0 and vol_f > 0:
                dollar_volume = mid_f * vol_f
        snapshot.dollar_volume += dollar_volume
        snapshot.trades += trade_count
        spread = payload.get("spreadBp") or payload.get("spread_bp")
        try:
            spread_f = float(spread)
        except Exception:
            spread_f = None
        if spread_f is not None and spread_f >= 0:
            snapshot.spread_sum += spread_f
            snapshot.spread_samples += 1
        snapshot.last_seen = ts

    def _reset_session(self, ts: datetime) -> None:
        self.log.info("resetting screener session for %s", ts.astimezone(EASTERN).date())
        self._snapshots.clear()
        self._session_start = ts
        self._schedule_next_refresh(ts)

    def _schedule_next_refresh(self, now: datetime) -> None:
        eastern = now.astimezone(EASTERN)
        market_open = eastern.replace(hour=9, minute=30, second=0, microsecond=0)
        if eastern < market_open:
            eastern = market_open
        if eastern.time() < time(10, 30):
            interval = 5
        elif eastern.time() < time(12, 0):
            interval = 15
        else:
            interval = 60
        next_eastern = eastern + timedelta(minutes=interval)
        self._next_refresh_at = next_eastern.astimezone(timezone.utc)
        self.log.debug("next screener refresh scheduled for %s", self._next_refresh_at)

    async def _emit_refresh(self, now: datetime) -> None:
        self._schedule_next_refresh(now)
        snapshots = list(self._snapshots.values())
        snapshots.sort(key=lambda item: item.dollar_volume, reverse=True)
        top = snapshots[: self.cfg.max_symbols]
        payload = {
            "ts": now.isoformat(),
            "nextRefreshTs": self._next_refresh_at.isoformat() if self._next_refresh_at else None,
            "todayTop": [item.to_dict() for item in top],
        }
        await GLOBAL_BUS.publish(self.cfg.output_topic, payload)
        self._state.update({
            "lastScreenerTs": payload["ts"],
            "nextRefreshTs": payload["nextRefreshTs"],
            "todayTop10": payload["todayTop"],
        })
        self._state_dirty = True
        self.log.info("screener emitted top %d symbols", len(top))

    def _write_state(self) -> None:
        state = self._read_existing_state()
        state.update(self._state)
        state.setdefault("todayTop10", [])
        try:
            self.cfg.state_file.parent.mkdir(parents=True, exist_ok=True)
            self.cfg.state_file.write_text(json.dumps(state, indent=2), encoding="utf-8")
        except OSError as exc:
            self.log.error("failed writing screener state: %s", exc)

    def _read_existing_state(self) -> Dict[str, Any]:
        try:
            raw = self.cfg.state_file.read_text(encoding="utf-8")
            return json.loads(raw)
        except (OSError, json.JSONDecodeError, TypeError):
            return {}


class UniverseService(AsyncService):
    def __init__(self, config: UniverseConfig) -> None:
        super().__init__("universe")
        self.cfg = config
        self._positions: Dict[str, float] = {}
        self._active: List[str] = []
        self._last_active: List[str] = []
        self._last_swap_at: Optional[datetime] = None
        self._screener_handler = None
        self._position_handler = None
        self._next_refresh_ts: Optional[str] = None
        self._state: Dict[str, Any] = {}
        self._state_dirty = False

    async def on_start(self) -> None:
        async def handle_screener(payload: dict) -> None:
            await self._handle_screener(payload)

        async def handle_position(payload: dict) -> None:
            symbol = payload.get("symbol")
            qty = payload.get("qty") or payload.get("quantity")
            if not symbol:
                return
            try:
                qty_f = float(qty)
            except Exception:
                qty_f = 0.0
            self._positions[symbol.upper()] = qty_f

        self._screener_handler = handle_screener
        self._position_handler = handle_position
        await GLOBAL_BUS.subscribe(self.cfg.screener_topic, handle_screener)
        await GLOBAL_BUS.subscribe(self.cfg.positions_topic, handle_position)
        self.log.info("universe subscribed to %s and %s", self.cfg.screener_topic, self.cfg.positions_topic)

    async def on_stop(self) -> None:
        if self._screener_handler:
            await GLOBAL_BUS.unsubscribe(self.cfg.screener_topic, self._screener_handler)
            self._screener_handler = None
        if self._position_handler:
            await GLOBAL_BUS.unsubscribe(self.cfg.positions_topic, self._position_handler)
            self._position_handler = None

    async def step(self) -> None:
        await asyncio.sleep(1)
        if self._state_dirty:
            self._write_state()
            self._state_dirty = False

    async def _handle_screener(self, payload: dict) -> None:
        now = _now_utc()
        top_entries = payload.get("todayTop") or payload.get("todayTop10") or []
        if not isinstance(top_entries, list):
            top_entries = []
        ready_models = self._discover_ready_models()
        reasons: Dict[str, str] = {}
        missing_models: List[str] = []
        for entry in top_entries:
            symbol = str(entry.get("symbol", "")).upper()
            if not symbol:
                continue
            if symbol not in ready_models:
                reasons[symbol] = "NO_READY_MODEL"
                missing_models.append(symbol)

        candidate = [str(entry.get("symbol", "")).upper() for entry in top_entries if str(entry.get("symbol", "")).upper() in ready_models]
        ready_for_today = sum(1 for entry in top_entries if str(entry.get("symbol", "")).upper() in ready_models)

        if not self._active:
            self._active = candidate[: self.cfg.max_symbols]
            self._last_swap_at = now
        else:
            churn_elapsed = (now - self._last_swap_at).total_seconds() / 60 if self._last_swap_at else None
            churn_ready = churn_elapsed is None or churn_elapsed >= self.cfg.churn_minutes
            if churn_ready:
                next_active: List[str] = []
                retained_for_position: List[str] = []
                desired_set = set(candidate[: self.cfg.max_symbols])
                for sym in self._active:
                    if sym in desired_set:
                        next_active.append(sym)
                    else:
                        qty = abs(self._positions.get(sym, 0.0))
                        if qty > 0:
                            reasons[sym] = "OPEN_POSITION"
                            next_active.append(sym)
                            retained_for_position.append(sym)
                for sym in candidate:
                    if sym in next_active:
                        continue
                    if len(next_active) >= self.cfg.max_symbols:
                        break
                    next_active.append(sym)
                retired = [sym for sym in self._active if sym not in next_active]
                self._active = next_active
                if retired:
                    self._last_swap_at = now
                elif any(sym not in self._last_active for sym in next_active):
                    self._last_swap_at = now
            else:
                guard_symbols = [sym for sym in candidate if sym not in self._active]
                for sym in guard_symbols:
                    reasons[sym] = "CHURN_GUARD"

        traded_summary: List[Dict[str, Any]] = []
        statuses: Dict[str, str] = {}
        previous_set = set(self._last_active)
        current_set = set(self._active)
        for sym in self._active:
            status = "kept" if sym in previous_set else "added now"
            if reasons.get(sym) == "OPEN_POSITION" and sym not in previous_set:
                status = "retained"
            statuses[sym] = status
            traded = reasons.get(sym) not in {"OPEN_POSITION"}
            traded_summary.append({
                "symbol": sym,
                "traded": traded,
                "reason": reasons.get(sym),
                "status": status,
            })

        retired_symbols = [sym for sym in self._last_active if sym not in current_set]
        retired_summary = [
            {"symbol": sym, "status": "retired after flat"}
            for sym in retired_symbols
            if abs(self._positions.get(sym, 0.0)) == 0
        ]

        intersection = []
        for entry in top_entries:
            symbol = str(entry.get("symbol", "")).upper()
            if not symbol:
                continue
            intersection.append({
                "symbol": symbol,
                "ready": symbol in ready_models,
                "reason": reasons.get(symbol),
                "dollarVolume": entry.get("dollarVolume"),
            })

        summary = {
            "ts": now.isoformat(),
            "nextRefreshTs": payload.get("nextRefreshTs") or self._next_refresh_ts,
            "nextChurnTs": (
                (self._last_swap_at + timedelta(minutes=self.cfg.churn_minutes)).isoformat()
                if self._last_swap_at
                else None
            ),
            "activeSymbols": traded_summary,
            "retiredSymbols": retired_summary,
            "todayTop10": top_entries,
            "intersection": intersection,
            "readyModels": sorted(ready_models),
            "readyCount": ready_for_today,
            "missingModels": missing_models,
            "modelsRequired": min(self.cfg.max_symbols, len(top_entries)),
            "lastScreenerTs": payload.get("ts"),
        }

        await GLOBAL_BUS.publish(self.cfg.output_topic, summary)
        self._state.update(summary)
        self._state_dirty = True
        self._last_active = list(self._active)
        self._next_refresh_ts = payload.get("nextRefreshTs")
        self.log.info("universe active set: %s", ",".join(self._active))

    def _discover_ready_models(self) -> set[str]:
        ready: set[str] = set()
        try:
            self.cfg.model_dir.mkdir(parents=True, exist_ok=True)
        except OSError:
            return ready
        for path in self.cfg.model_dir.glob("*_metadata.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            symbol = str(data.get("symbol", "")).upper()
            if not symbol:
                continue
            ready.add(symbol)
        return ready

    def _write_state(self) -> None:
        state = self._read_existing_state()
        state.update(self._state)
        try:
            self.cfg.state_file.parent.mkdir(parents=True, exist_ok=True)
            self.cfg.state_file.write_text(json.dumps(state, indent=2), encoding="utf-8")
        except OSError as exc:
            self.log.error("failed writing universe state: %s", exc)

    def _read_existing_state(self) -> Dict[str, Any]:
        try:
            raw = self.cfg.state_file.read_text(encoding="utf-8")
            return json.loads(raw)
        except (OSError, json.JSONDecodeError, TypeError):
            return {}
