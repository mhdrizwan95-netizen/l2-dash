from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from ib_insync import IB, Stock, MarketOrder, LimitOrder
from datetime import datetime, timezone
import asyncio
from threading import Thread
from typing import Any, Dict, List
import numpy as np

app = FastAPI()

# -------- IB runtime on its own loop/thread --------
class IBRuntime:
    def __init__(self):
        self.loop: asyncio.AbstractEventLoop | None = None
        self.ib: IB | None = None
        self.thread: Thread | None = None

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        def runner():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            self.loop = loop
            self.ib = IB()
            loop.run_forever()
        self.thread = Thread(target=runner, name="IBLoopThread", daemon=True)
        self.thread.start()

    async def run(self, coro):
        if not self.loop:
            raise RuntimeError("IB loop not started")
        if not asyncio.iscoroutine(coro):
            raise TypeError("A coroutine object is required")
        fut = asyncio.run_coroutine_threadsafe(coro, self.loop)
        return await asyncio.wrap_future(fut)

rt = IBRuntime()

@app.on_event("startup")
async def on_startup():
    rt.start()

# -------- Models --------
class ConnectReq(BaseModel):
    host: str = "127.0.0.1"
    port: int = 7497
    clientId: int = 77
    readonly: bool = True

class OrderReq(BaseModel):
    symbol: str
    side: str   # BUY | SELL
    qty: int
    limitPrice: float | None = None

# -------- Helpers --------
def _bars_to_dict(b) -> Dict[str, Any]:
    return {
        "date": str(b.date),
        "open": float(b.open),
        "high": float(b.high),
        "low": float(b.low),
        "close": float(b.close),
        "volume": int(b.volume or 0),
        "wap": float(b.wap or 0.0),
        "barCount": int(b.barCount or 0),
    }

# -------- Endpoints --------
@app.get("/health")
async def health():
    return {
        "ok": True,
        "ibThreadAlive": bool(rt.thread and rt.thread.is_alive()),
        "ibLoopReady": rt.loop is not None,
        "ibConnected": bool(rt.ib and rt.ib.isConnected()),
    }

@app.post("/connect")
async def connect(req: ConnectReq):
    try:
        if not rt.ib:
            raise HTTPException(status_code=500, detail="IB runtime not initialized")
        if rt.ib.isConnected():
            return {"connected": True}

        async def do():
            return await rt.ib.connectAsync(
                req.host, req.port, clientId=req.clientId, readonly=req.readonly
            )

        await rt.run(do())
        return {"connected": rt.ib.isConnected()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"connect error: {e!r}")

@app.get("/balances")
async def balances():
    if not (rt.ib and rt.ib.isConnected()):
        return {"connected": False}
    try:
        async def do():
            return await rt.ib.accountSummaryAsync()

        summ = await rt.run(do())
        tags = ["NetLiquidation", "AvailableFunds", "CashBalance", "SettledCash"]
        data = {x.tag: float(x.value) for x in summ if x.tag in tags}
        return {"connected": True, **data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"balances error: {e!r}")

@app.get("/positions")
async def positions():
    if not (rt.ib and rt.ib.isConnected()):
        return {"connected": False, "positions": []}
    try:
        async def do():
            return await rt.ib.reqPositionsAsync()

        pos_list = await rt.run(do())
        rows: List[Dict[str, Any]] = []
        for item in pos_list:
            # Accept Position objects or tuple payloads
            if hasattr(item, "account"):
                acc = item.account
                contract = getattr(item, "contract", None)
                sym = getattr(contract, "symbol", "") if contract else ""
                qty = float(getattr(item, "position", 0) or 0)
                avg = float(getattr(item, "avgCost", 0) or 0)
            else:
                acc, contract, qty, avg = item[0], item[1], float(item[2] or 0), float(item[3] or 0)
                sym = getattr(contract, "symbol", "") if contract else ""
            rows.append({"account": acc, "symbol": sym, "position": qty, "avgCost": avg})
        return {"connected": True, "positions": rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"positions error: {e!r}")

@app.post("/order")
async def place_order(req: OrderReq):
    if not (rt.ib and rt.ib.isConnected()):
        raise HTTPException(status_code=503, detail="not connected")
    try:
        contract = Stock(req.symbol, "SMART", "USD")

        async def do():
            await rt.ib.qualifyContractsAsync(contract)
            action = "BUY" if req.side.upper() == "BUY" else "SELL"
            order = MarketOrder(action, req.qty) if req.limitPrice is None else LimitOrder(action, req.qty, req.limitPrice)
            trade = rt.ib.placeOrder(contract, order)

            # wait briefly for status/fills on the IB thread loop
            loop = asyncio.get_running_loop()
            end = loop.time() + 3.0
            while trade.isActive() and loop.time() < end:
                await asyncio.sleep(0.1)

            status = trade.orderStatus.status
            price = float(trade.orderStatus.avgFillPrice or (req.limitPrice or 0.0))
            fee = 0.0
            for f in trade.fills or []:
                cr = getattr(f, "commissionReport", None)
                if cr and cr.commission is not None:
                    fee += abs(cr.commission)
            return {
                "orderId": trade.order.permId or trade.order.orderId or 0,
                "status": status,
                "symbol": req.symbol,
                "side": action,
                "qty": req.qty,
                "price": round(price, 4),
                "fee": round(fee, 4),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }

        return await rt.run(do())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"order error: {e!r}")

@app.get("/bars")
async def bars(symbol: str, duration: str = "1 D", barSize: str = "1 min", whatToShow: str = "TRADES"):
    if not (rt.ib and rt.ib.isConnected()):
        raise HTTPException(status_code=503, detail="not connected")
    contract = Stock(symbol, "SMART", "USD")

    async def do():
        await rt.ib.qualifyContractsAsync(contract)
        bars = await rt.ib.reqHistoricalDataAsync(
            contract,
            endDateTime="",
            durationStr=duration,
            barSizeSetting=barSize,
            whatToShow=whatToShow,
            useRTH=True,
            formatDate=2,
        )
        return [_bars_to_dict(b) for b in bars]

    try:
        return await rt.run(do())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"bars error: {e!r}")

@app.get("/odds")
async def odds(symbol: str, lookback: int = 120):
    if not (rt.ib and rt.ib.isConnected()):
        raise HTTPException(status_code=503, detail="not connected")

    contract = Stock(symbol, "SMART", "USD")

    async def fetch():
        await rt.ib.qualifyContractsAsync(contract)
        return await rt.ib.reqHistoricalDataAsync(
            contract,
            endDateTime="",
            durationStr="2 D",
            barSizeSetting="1 min",
            whatToShow="TRADES",
            useRTH=True,
            formatDate=2,
        )

    bar_list = await rt.run(fetch())
    closes = [float(b.close) for b in bar_list][-lookback - 1 :]
    if len(closes) < 2:
        return {"symbol": symbol, "count": 0, "odds": None}

    r = np.diff(np.array(closes)) / np.array(closes[:-1])
    lo, hi = np.quantile(r, [0.33, 0.67]) if len(r) >= 10 else (-1e-6, 1e-6)

    def state(x: float) -> int:
        return 0 if x < lo else (2 if x > hi else 1)  # 0=down,1=flat,2=up

    states = np.array([state(x) for x in r])
    K = 3
    T = np.zeros((K, K), dtype=float)
    for a, b in zip(states[:-1], states[1:]):
        T[a, b] += 1
    row_sums = T.sum(axis=1, keepdims=True)
    T = np.divide(T, np.where(row_sums == 0, 1, row_sums), where=row_sums != 0)

    cur = int(states[-1])
    probs = T[cur].tolist()  # [down, flat, up]
    return {
        "symbol": symbol,
        "count": int(len(r)),
        "state_names": ["down", "flat", "up"],
        "current_state": ["down", "flat", "up"][cur],
        "transition_row": {"down": probs[0], "flat": probs[1], "up": probs[2]},
        "thresholds": {"lo": float(lo), "hi": float(hi)},
    }
