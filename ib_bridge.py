"""Lightweight IBKR bridge that forwards ticks to the Next.js ingest endpoint.

The connection parameters and shared ingest secret are sourced from
``sessions/bridge-settings.json`` so the UI can control them. Run with
``pip install ib-insync requests`` and ensure TWS/Gateway is open.
"""

from __future__ import annotations

import json
import math
import os
import time
from pathlib import Path
from typing import Any, Dict, Iterable, Tuple

import requests
from ib_insync import IB, Stock


BASE_DIR = Path(__file__).resolve().parent
SETTINGS_PATH = Path(os.getenv("L2_SETTINGS_FILE", BASE_DIR / "sessions" / "bridge-settings.json"))
APP_INGEST = os.getenv("APP_INGEST", "http://127.0.0.1:3000/api/ingest")
APP_ACCOUNT = os.getenv("APP_ACCOUNT", "http://127.0.0.1:3000/api/account")
DEFAULT_SYMBOLS: Iterable[Tuple[str, str, str]] = [
    ("AAPL", "SMART", "USD"),
    ("MSFT", "SMART", "USD"),
]


def load_bridge_settings() -> Dict[str, Any]:
    defaults: Dict[str, Any] = {
        "host": "127.0.0.1",
        "port": 7497,
        "clientId": 42,
        "ingestKey": "",
        "account": "All",
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
    if isinstance(data.get("host"), str) and data["host"].strip():
        defaults["host"] = data["host"].strip()
    if isinstance(data.get("port"), (int, float)):
        defaults["port"] = int(data["port"])
    if isinstance(data.get("clientId"), (int, float)):
        defaults["clientId"] = int(data["clientId"])
    if isinstance(data.get("ingestKey"), str):
        defaults["ingestKey"] = data["ingestKey"].strip()
    if isinstance(data.get("account"), str) and data["account"].strip():
        defaults["account"] = data["account"].strip()
    return defaults


def post_tick(symbol: str, price: float, ts: float, ingest_key: str) -> None:
    headers = {"x-ingest-key": ingest_key} if ingest_key else {}
    try:
        requests.post(
            APP_INGEST,
            json={"symbol": symbol, "price": float(price), "ts": int(ts * 1000)},
            headers=headers,
            timeout=1.5,
        )
    except Exception as exc:  # pragma: no cover - network side effects
        print("POST failed:", exc)


def post_account(summary: Dict[str, float], ingest_key: str) -> None:
    headers = {"x-ingest-key": ingest_key} if ingest_key else {}
    try:
        requests.post(
            APP_ACCOUNT,
            json=summary,
            headers=headers,
            timeout=1.5,
        )
    except Exception as exc:  # pragma: no cover - network side effects
        print("Account POST failed:", exc)


def main(symbols: Iterable[Tuple[str, str, str]] = DEFAULT_SYMBOLS) -> None:
    settings = load_bridge_settings()
    ingest_key = settings.get("ingestKey", "")
    account_code = settings.get("account", "All") or "All"

    ib = IB()
    ib.connect(
        settings.get("host", "127.0.0.1"),
        int(settings.get("port", 7497)),
        clientId=int(settings.get("clientId", 42)),
        readonly=True,
    )

    contracts = {sym: Stock(sym, exch, curr) for sym, exch, curr in symbols}
    tickers = {symbol: ib.reqMktData(contract, snapshot=False) for symbol, contract in contracts.items()}
    last_emit = 0.0

    def on_update(ticker) -> None:
        nonlocal last_emit
        symbol = next((s for s, t in tickers.items() if t is ticker), None)
        if not symbol:
            return
        price = ticker.last if ticker.last and not math.isnan(ticker.last) else ticker.marketPrice()
        if not price or math.isnan(price):
            return
        now = time.time()
        if now - last_emit < 0.2:  # throttle to ~5Hz across symbols
            return
        last_emit = now
        post_tick(symbol, price, now, ingest_key)

    for ticker in tickers.values():
        ticker.updateEvent += on_update

    last_account_emit = 0.0
    last_account_payload: Dict[str, float] | None = None

    def collect_account() -> Dict[str, float] | None:
        try:
            rows = ib.accountSummary(account_code)
        except Exception as exc:  # pragma: no cover - IB errors
            print("account summary error:", exc)
            return None
        if not rows:
            return None
        summary: Dict[str, float] = {}
        for row in rows:
            if row.currency and row.currency != 'USD':
                continue
            try:
                value = float(row.value)
            except (TypeError, ValueError):
                continue
            tag = row.tag
            if tag == 'TotalCashValue':
                summary['cash'] = value
            elif tag == 'AvailableFunds':
                summary['availableFunds'] = value
            elif tag == 'BuyingPower':
                summary['buyingPower'] = value
            elif tag == 'InitMarginReq':
                summary['marginUsed'] = value
            elif tag == 'NetLiquidation':
                summary['netLiquidation'] = value
            elif tag == 'EquityWithLoanValue':
                summary['equityWithLoan'] = value
        if not summary:
            return None
        summary.setdefault('cash', 0.0)
        summary.setdefault('availableFunds', summary.get('cash', 0.0))
        summary.setdefault('buyingPower', summary.get('availableFunds', 0.0) * 2)
        summary.setdefault('marginUsed', 0.0)
        summary.setdefault('netLiquidation', summary.get('equityWithLoan', summary.get('cash', 0.0)))
        summary.setdefault('equityWithLoan', summary.get('netLiquidation', 0.0))
        summary['ts'] = time.time()
        return summary

    try:
        while True:
            ib.sleep(0.1)
            now = time.time()
            if now - last_account_emit >= 5.0:
                payload = collect_account()
                if payload and payload != last_account_payload:
                    post_account(payload, ingest_key)
                    last_account_payload = payload
                last_account_emit = now
    except KeyboardInterrupt:  # pragma: no cover - manual stop
        pass
    finally:
        ib.disconnect()


if __name__ == "__main__":
    main()
