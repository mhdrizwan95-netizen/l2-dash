from __future__ import annotations

import asyncio
import contextlib
import csv
import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

try:  # pragma: no cover
    from ib_insync import IB, Contract, Ticker, util
except ImportError:  # pragma: no cover
    IB = Contract = Ticker = util = None  # type: ignore

try:  # pragma: no cover
    from aiohttp import web
    from aiohttp_sse import sse_response
except ImportError:  # pragma: no cover
    web = sse_response = None  # type: ignore

from logging import Logger

from services.common.event_bus import GLOBAL_BUS
from services.common.schemas import Tick, Trade
from services.common.service import AsyncService
from services.instrument import features as ft


@dataclass(frozen=True)
class SymbolConfig:
    symbol: str
    exchange: str = "SMART"
    currency: str = "USD"
    sec_type: str = "STK"
    primary_exchange: Optional[str] = None

    def to_contract(self) -> Contract:
        contract = Contract(
            symbol=self.symbol,
            secType=self.sec_type,
            exchange=self.exchange,
            currency=self.currency,
        )
        if self.primary_exchange:
            contract.primaryExchange = self.primary_exchange
        return contract


@dataclass
class BlotterConfig:
    symbols: List[SymbolConfig] = field(default_factory=lambda: [SymbolConfig("AAPL")])
    ib_host: str = "127.0.0.1"
    ib_port: int = 7497
    client_id: int = 42
    topic_ticks: str = "ticks"
    topic_book: str = "ticks.book"
    topic_trades: str = "ticks.trades"
    feature_window: int = 30
    enable_depth: bool = False
    record_path: Optional[str] = None
    symbols_file: Optional[str] = field(default_factory=lambda: os.getenv("L2_SYMBOLS_FILE"))
    symbol_poll_interval: float = 2.0


class IBKRFeed:
    def __init__(
        self,
        config: BlotterConfig,
        loop: asyncio.AbstractEventLoop,
        emit: Callable[[str, dict], None],
        log: Logger,
        record: Optional[Callable[[str, Tick], None]] = None,
        standardizer: Optional[ft.FeatureStandardizer] = None,
    ) -> None:
        if IB is None:
            raise RuntimeError("ib-insync is required for live blotter")
        self.cfg = config
        self.loop = loop
        self.emit = emit
        self.log = log
        self.record_cb = record
        self.ib = IB()
        self.tickers: Dict[str, Any] = {}
        self.contracts: Dict[str, Any] = {}
        self._standardizer = standardizer or ft.FeatureStandardizer(self.cfg.feature_window)

    async def start(self) -> None:
        util.logToConsole(False)
        await self.ib.connectAsync(self.cfg.ib_host, self.cfg.ib_port, clientId=self.cfg.client_id, readonly=True)
        await self.update_symbols(self.cfg.symbols)

    async def stop(self) -> None:
        for ticker in self.tickers.values():
            ticker.updateEvent.clear()
        if self.ib.isConnected():
            await asyncio.to_thread(self.ib.disconnect)
        self.tickers.clear()
        self.contracts.clear()

    async def update_symbols(self, configs: List[SymbolConfig]) -> None:
        desired: Dict[str, SymbolConfig] = {cfg.symbol: cfg for cfg in configs}
        current = set(self.tickers.keys())
        desired_set = set(desired.keys())

        for symbol in current - desired_set:
            await self._remove_symbol(symbol)

        for symbol in desired_set:
            cfg = desired[symbol]
            existing_cfg = next((c for c in self.cfg.symbols if c.symbol == symbol), None)
            if symbol not in self.tickers or existing_cfg != cfg:
                if existing_cfg and existing_cfg != cfg:
                    await self._remove_symbol(symbol)
                await self._add_symbol(cfg)

        self.cfg.symbols = list(desired.values())

    async def _add_symbol(self, sym_cfg: SymbolConfig) -> None:
        symbol = sym_cfg.symbol
        contract = sym_cfg.to_contract()

        try:
            # It's best practice to qualify the contract to make it unambiguous
            qualified_contracts = await self.ib.qualifyContractsAsync(contract)
            qualified_contract = qualified_contracts[0]
            ticker = self.ib.reqMktData(qualified_contract, "", False, False)
            ticker.updateEvent += self._make_handler(symbol)
            self.contracts[symbol] = qualified_contract
            self.tickers[symbol] = ticker
            if self.cfg.enable_depth:
                try:
                    self.ib.reqMktDepth(qualified_contract, numRows=5, isSmartDepth=False)
                except Exception as exc:  # pragma: no cover - IBKR depth optional
                    self.log.warning("depth unavailable for %s: %s", symbol, exc)
            self.log.info("subscribed to %s", symbol)
        except Exception as exc:  # pragma: no cover - network/contract errors
            self.log.error("failed subscribing to %s: %s", symbol, exc)

    async def _remove_symbol(self, symbol: str) -> None:
        ticker = self.tickers.pop(symbol, None)
        if ticker:
            ticker.updateEvent.clear()
        contract = self.contracts.pop(symbol, None)
        if contract is not None:
            with contextlib.suppress(Exception):  # pragma: no cover - IBKR cancel may raise
                self.ib.cancelMktData(contract)
            if self.cfg.enable_depth:
                with contextlib.suppress(Exception):
                    self.ib.cancelMktDepth(contract)
        self.log.info("unsubscribed from %s", symbol)

    def _make_handler(self, symbol: str) -> Callable[[Any], None]:
        def handler(ticker: Any) -> None:
            self.loop.call_soon_threadsafe(self._process_update, symbol, ticker)
        return handler

    def _process_update(self, symbol: str, ticker: Any) -> None:
        best_bid = ticker.bid or 0.0
        best_ask = ticker.ask or 0.0
        if best_bid <= 0 or best_ask <= 0:
            return
        mid = ft.mid_price(best_bid, best_ask)
        spread = ft.spread_bp(best_bid, best_ask)
        bids = [(lvl.price, lvl.size) for lvl in (ticker.domBids or []) if lvl.price and lvl.size]
        asks = [(lvl.price, lvl.size) for lvl in (ticker.domAsks or []) if lvl.price and lvl.size]
        if not bids:
            bids = [(best_bid, ticker.bidSize or 0.0)]
        if not asks:
            asks = [(best_ask, ticker.askSize or 0.0)]
        imb = ft.order_flow_imbalance(best_bid, best_ask, bids, asks)
        micro = ft.microprice(bids, asks)
        vol = ft.rolling_volatility([mid, micro])
        raw_features = [mid, spread, imb, micro, vol]
        features = self._standardizer.transform(symbol, raw_features)
        self.log.debug(
            "features computed",
            extra={
                "symbol": symbol,
                "rawFeatures": raw_features,
                "standardizedFeatures": features,
            },
        )

        tick = Tick(
            symbol=symbol,
            ts=datetime.now(timezone.utc),
            mid=mid,
            spreadBp=spread,
            imb=imb,
            depth=[list(item) for item in (bids[:3] + asks[:3])],
            trades=self._build_trade_list(symbol, ticker),
            features=features,
        )
        payload = tick.to_payload()
        self.emit(self.cfg.topic_ticks, payload)
        if self.record_cb:
            self.record_cb(symbol, tick)

        book_payload = {
            "symbol": symbol,
            "ts": tick.ts.isoformat(),
            "bids": [[lvl.price, lvl.size] for lvl in (ticker.domBids or [])[:5]],
            "asks": [[lvl.price, lvl.size] for lvl in (ticker.domAsks or [])[:5]],
        }
        self.emit(self.cfg.topic_book, book_payload)

        trade_payload = self._build_trade_event(symbol, ticker)
        if trade_payload:
            self.emit(self.cfg.topic_trades, trade_payload)

    def _build_trade_list(self, symbol: str, ticker: Any) -> Optional[List[dict]]:
        if ticker.last is None or ticker.lastSize is None:
            return None
        return [
            Trade(px=float(ticker.last), size=float(ticker.lastSize), side="BUY" if (ticker.last or 0) >= (ticker.midpoint() or 0) else "SELL").dict()
        ]

    def _build_trade_event(self, symbol: str, ticker: Any) -> Optional[dict]:
        if ticker.last is None or ticker.lastSize is None:
            return None
        aggressor = "BUY" if (ticker.last or 0) >= (ticker.midpoint() or 0) else "SELL"
        return {
            "symbol": symbol,
            "ts": datetime.now(timezone.utc).isoformat(),
            "price": float(ticker.last),
            "size": float(ticker.lastSize),
            "aggressor": aggressor,
        }


class BlotterService(AsyncService):
    def __init__(self, config: BlotterConfig) -> None:
        super().__init__("blotter")
        self.config = config
        self._queue: asyncio.Queue[Tuple[str, dict]] = asyncio.Queue()
        self._feed: Optional[IBKRFeed] = None
        self._record_queue: Optional[asyncio.Queue[Tuple[str, dict]]] = None
        self._writer_task: Optional[asyncio.Task] = None
        self._record_path = Path(self.config.record_path) if self.config.record_path else None
        self._symbol_file = Path(self.config.symbols_file).resolve() if self.config.symbols_file else None
        self._symbol_task: Optional[asyncio.Task] = None
        self._last_symbol_mtime: Optional[float] = None
        self._symbols_signature: Optional[Tuple[Tuple[str, str, str, str, Optional[str]], ...]] = None
        self._sse_clients: List[web.StreamResponse] = []
        self._web_runner: Optional[web.AppRunner] = None
        self._web_task: Optional[asyncio.Task] = None
        self._standardizer = ft.FeatureStandardizer(self.config.feature_window)


    async def on_start(self) -> None:
        self.log.info("connecting to IBKR host=%s:%s", self.config.ib_host, self.config.ib_port)

        await self._sync_symbols(force=True, push_to_feed=False)

        if self._record_path:
            self._record_path.mkdir(parents=True, exist_ok=True)
            self._record_queue = asyncio.Queue()
            self._writer_task = self.loop.create_task(self._record_worker())
        def emit(topic: str, payload: dict) -> None:
            self.loop.call_soon_threadsafe(self._queue.put_nowait, (topic, payload))

        try:
            feed = IBKRFeed(self.config, self.loop, emit, self.log, self._enqueue_record, self._standardizer)
            await feed.start()
            await feed.update_symbols(self.config.symbols)
            self._feed = feed
            self.log.info("connected to IBKR feed")
            if self._symbol_file:
                self._symbol_task = self.loop.create_task(self._watch_symbols())
            await self._start_web_server()
            return
        except Exception as exc:
            self.log.exception("failed to connect to IBKR: %s", exc)
            raise

    async def on_stop(self) -> None:
        if self._feed:
            await self._feed.stop()
        if self._writer_task:
            self._writer_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._writer_task
            self._writer_task = None
        if self._symbol_task:
            self._symbol_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._symbol_task
            self._symbol_task = None
        while not self._queue.empty():
            self._queue.get_nowait()
        if self._web_runner:
            await self._web_runner.cleanup()
        if self._record_queue:
            while not self._record_queue.empty():
                self._record_queue.get_nowait()

    async def step(self) -> None:
        topic, payload = await self._queue.get()
        await GLOBAL_BUS.publish(topic, payload)
        if topic == self.config.topic_ticks:
            await self._broadcast_sse(payload)
        self._queue.task_done()

    async def _start_web_server(self) -> None:
        if not web:
            self.log.warning("aiohttp is not installed, SSE endpoint disabled.")
            return

        app = web.Application()
        app.router.add_get("/sse/ticks", self._sse_handler)
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", 8080)
        self._web_runner = runner
        self._web_task = self.loop.create_task(site.start())
        self.log.info("SSE endpoint running at http://0.0.0.0:8080/sse/ticks")

    async def _sse_handler(self, request: web.Request) -> web.StreamResponse:
        async with sse_response(request) as resp:
            self._sse_clients.append(resp)
            self.log.info("SSE client connected. Total clients: %d", len(self._sse_clients))
            try:
                await resp.wait()
            finally:
                self._sse_clients.remove(resp)
                self.log.info("SSE client disconnected. Total clients: %d", len(self._sse_clients))
        return resp

    async def _broadcast_sse(self, payload: dict) -> None:
        if not self._sse_clients:
            return
        
        # Use a copy to avoid issues if a client disconnects during iteration
        clients = self._sse_clients[:]
        for client in clients:
            if not client.is_connected():
                continue
            try:
                await client.send(json.dumps(payload))
            except ConnectionResetError:
                self.log.debug("SSE client connection reset")
            except Exception as e:
                self.log.warning("Error sending to SSE client: %s", e)

    async def _watch_symbols(self) -> None:
        assert self._symbol_file is not None
        while self._running:
            await asyncio.sleep(self.config.symbol_poll_interval)
            try:
                mtime = self._symbol_file.stat().st_mtime
            except FileNotFoundError:
                continue
            if self._last_symbol_mtime is None or mtime > self._last_symbol_mtime:
                self._last_symbol_mtime = mtime
                await self._sync_symbols(force=True)

    async def _sync_symbols(self, *, force: bool = False, push_to_feed: bool = True) -> None:
        symbols = self._load_symbols_from_file()
        if not symbols:
            return
        signature = tuple(
            (
                cfg.symbol,
                cfg.exchange,
                cfg.currency,
                cfg.sec_type,
                cfg.primary_exchange,
            )
            for cfg in symbols
        )
        if not force and signature == self._symbols_signature:
            return
        self._symbols_signature = signature
        self.config.symbols = symbols
        if self._symbol_file and self._symbol_file.exists():
            try:
                self._last_symbol_mtime = self._symbol_file.stat().st_mtime
            except OSError:
                self._last_symbol_mtime = None
        if self._feed and push_to_feed:
            await self._feed.update_symbols(symbols)
            self.log.info("updated symbols: %s", ", ".join(cfg.symbol for cfg in symbols))

    def _load_symbols_from_file(self) -> List[SymbolConfig]:
        if not self._symbol_file:
            return self.config.symbols
        try:
            raw = self._symbol_file.read_text(encoding="utf-8")
        except FileNotFoundError:
            self.log.debug("symbol file %s not found", self._symbol_file)
            return self.config.symbols
        except OSError as exc:
            self.log.warning("unable to read symbol file %s: %s", self._symbol_file, exc)
            return self.config.symbols

        if not raw.strip():
            return self.config.symbols

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            self.log.error("invalid JSON in %s: %s", self._symbol_file, exc)
            return self.config.symbols

        if isinstance(data, dict):
            items = data.get("symbols", [])
        else:
            items = data

        if not isinstance(items, list):
            self.log.warning("symbol file %s has unexpected format", self._symbol_file)
            return self.config.symbols

        defaults = self.config.symbols[0] if self.config.symbols else SymbolConfig("AAPL")
        seen: set[str] = set()
        result: List[SymbolConfig] = []
        for item in items:
            cfg: Optional[SymbolConfig] = None
            if isinstance(item, str):
                symbol = item.strip().upper()
                if symbol:
                    cfg = SymbolConfig(symbol)
            elif isinstance(item, dict):
                symbol_str = str(item.get("symbol", "")).strip().upper()
                if symbol_str:
                    cfg = SymbolConfig(
                        symbol=symbol_str,
                        exchange=str(item.get("exchange", defaults.exchange or "SMART")),
                        currency=str(item.get("currency", defaults.currency or "USD")),
                        sec_type=str(item.get("secType", defaults.sec_type or "STK")),
                        primary_exchange=item.get("primaryExchange") or defaults.primary_exchange,
                    )
            if cfg and cfg.symbol not in seen:
                seen.add(cfg.symbol)
                result.append(cfg)

        return result or self.config.symbols

    def _enqueue_record(self, symbol: str, tick: Tick) -> None:
        if not self._record_queue:
            return
        record = {
            "symbol": symbol,
            "ts": tick.ts.isoformat(),
            "mid": tick.mid,
            "spreadBp": tick.spread_bp,
            "imb": tick.imb,
            "features": tick.features,
        }
        self._record_queue.put_nowait((symbol, record))

    async def _record_worker(self) -> None:
        assert self._record_queue is not None
        while True:
            symbol, record = await self._record_queue.get()
            await asyncio.to_thread(self._append_record, symbol, record)
            self._record_queue.task_done()

    def _append_record(self, symbol: str, record: dict) -> None:
        if not self._record_path:
            return
        day = record["ts"][:10]
        path = self._record_path / f"{symbol}_{day}.csv"
        write_header = not path.exists()
        with path.open("a", newline="") as f:
            writer = csv.writer(f)
            if write_header:
                writer.writerow(["ts", "mid", "spreadBp", "imb", "features"])
            writer.writerow([
                record["ts"],
                record["mid"],
                record["spreadBp"],
                record["imb"],
                ";".join(str(x) for x in record["features"]),
            ])
