"""Local dev runner for blotter, broker, shadow, and algo services.

Real IBKR market data is required—the pipeline will exit if the feed
connection fails. Swap in production-grade strategies as milestones progress.
"""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict

from services.algo.policy import PolicyConfig
from services.algo.service import AlgoConfig, AlgoService
from services.blotter.service import BlotterConfig, BlotterService, SymbolConfig
from services.broker.guardrails import GuardrailConfig
from services.broker.service import BrokerConfig, BrokerService
from services.reports.next_bridge import NextBridgeConfig, NextBridgeService
from services.commands.service import CommandConfig, CommandService
from services.universe.service import ScreenerConfig, ScreenerService, UniverseConfig, UniverseService
from services.shadow.service import ShadowConfig, ShadowService


SETTINGS_PATH = Path(os.getenv("L2_SETTINGS_FILE", "sessions/bridge-settings.json"))


def load_bridge_settings() -> Dict[str, Any]:
    defaults: Dict[str, Any] = {
        "host": "127.0.0.1",
        "port": 7497,
        "clientId": 42,
        "account": "",
        "ingestKey": "",
        "tradingEnabled": True,
    }
    try:
        raw = SETTINGS_PATH.read_text(encoding="utf-8")
    except FileNotFoundError:
        return defaults
    except OSError:
        return defaults
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return defaults
    if not isinstance(data, dict):
        return defaults
    merged = {**defaults}
    if isinstance(data.get("host"), str) and data["host"].strip():
        merged["host"] = data["host"].strip()
    if isinstance(data.get("port"), (int, float)):
        merged["port"] = int(data["port"])
    if isinstance(data.get("clientId"), (int, float)):
        merged["clientId"] = int(data["clientId"])
    if isinstance(data.get("account"), str):
        merged["account"] = data["account"].strip()
    if isinstance(data.get("ingestKey"), str):
        merged["ingestKey"] = data["ingestKey"].strip()
    if isinstance(data.get("tradingEnabled"), bool):
        merged["tradingEnabled"] = data["tradingEnabled"]
    return merged


async def main() -> None:
    symbols_file = os.getenv("L2_SYMBOLS_FILE", "sessions/active-symbols.json")

    def load_configured_symbols(path: str) -> list[SymbolConfig]:
        if not path or not os.path.exists(path):
            return []
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError):
            return []
        items = data.get("symbols", data) if isinstance(data, dict) else data
        if not isinstance(items, list):
            return []
        result: list[SymbolConfig] = []
        for entry in items:
            if isinstance(entry, str):
                symbol = entry.strip().upper()
                if symbol:
                    result.append(SymbolConfig(symbol))
            elif isinstance(entry, dict):
                symbol = str(entry.get("symbol", "")).strip().upper()
                if not symbol:
                    continue
                result.append(
                    SymbolConfig(
                        symbol=symbol,
                        exchange=str(entry.get("exchange", "SMART")),
                        currency=str(entry.get("currency", "USD")),
                        sec_type=str(entry.get("secType", "STK")),
                        primary_exchange=entry.get("primaryExchange"),
                    )
                )
        return result

    initial_symbols = load_configured_symbols(symbols_file)
    if not initial_symbols:
        print("[run_local] No symbols configured yet. Populate sessions/active-symbols.json via the dashboard to begin streaming.")

    bridge_settings = load_bridge_settings()

    blotter_cfg = BlotterConfig(
        symbols=initial_symbols,
        enable_depth=False,
        client_id=bridge_settings.get("clientId", 42) or 42,
        ib_host=bridge_settings.get("host", "127.0.0.1"),
        ib_port=int(bridge_settings.get("port", 7497) or 7497),
        record_path="data/ticks",
        symbols_file=symbols_file,
    )
    blotter = BlotterService(blotter_cfg)
    guardrails = GuardrailConfig(max_position=5, max_spread_bp=25.0, cooldown_ms=2_000)
    broker_cfg = BrokerConfig(trading_enabled=bool(bridge_settings.get("tradingEnabled", True)))
    broker = BrokerService(broker_cfg, guardrails)
    policy_cfg = PolicyConfig(base_qty=1, force_trade=True, alternate_sides=True)
    initial_universe = [cfg.symbol for cfg in initial_symbols] or ["AAPL"]
    if not initial_symbols:
        print(f"[run_local] Defaulting Algo to {initial_universe[0]}. Update strategy symbols to change this.")
    algo = AlgoService(AlgoConfig(symbols=initial_universe), broker, policy_cfg)
    shadow = ShadowService(ShadowConfig())
    next_bridge = NextBridgeService(
        NextBridgeConfig(
            base_url=os.getenv("NEXT_URL", "http://127.0.0.1:3000"),
            ingest_key=bridge_settings.get("ingestKey") or None,
        )
    )
    screener = ScreenerService(ScreenerConfig())
    universe = UniverseService(UniverseConfig())
    command = CommandService(CommandConfig(), broker)

    await asyncio.gather(
        blotter.run_forever(),
        broker.run_forever(),
        algo.run_forever(),
        shadow.run_forever(),
        next_bridge.run_forever(),
        screener.run_forever(),
        universe.run_forever(),
        command.run_forever(),
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
