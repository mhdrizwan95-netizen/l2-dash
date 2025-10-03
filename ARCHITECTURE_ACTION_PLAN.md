# L2 HMM Trading System — Action Plan (QTPyLib-style Architecture)

**Purpose:** This document tells any engineer or AI *exactly* how to adapt, build, and deploy our system using the architecture shown (Blotter, Broker, Algo, Reports, Strategies). It defines components, interfaces, milestones, acceptance criteria, and operational runbooks so work can continue without hand‑holding.

---

## 0) North Star (What we’re building)
A **real‑time L2 trading pipeline** that:
- Trains a **Hidden Markov Model (HMM)** from historical L2 data.
- Updates online from live ticks (minibatch EM).
- Emits **state + action** to a **Strategy Runner (Algo)**.
- Routes **orders via a Broker** to IBKR Paper/Live.
- Tracks **paper vs shadow fills** to estimate live slippage.
- Runs safely under **guardrails** on a **VPS in NJ**.
- Surfaces **Reports** (dashboard + REST) for monitoring and exports.

**End state:** Controlled live trading with tiny size, then gradual scale‑up.

---

## 1) Component Map (QTPyLib ⇄ Our Modules)
- **Blotter (market data)** → `services/blotter`  
  Input: IBKR L2 & trades. Output: normalized ticks + derived **features**; publishes via in‑process bus + SSE to UI; feeds Shadow Sim.

- **Broker (abstracted)** → `services/broker`  
  Single API to **place/cancel/flatten** orders. Applies guardrails (spread, max pos, cooldown, latency, DD cap). Selects paper vs live endpoints.

- **Algo (extends Broker)** → `services/algo`  
  Strategy orchestrator. Subscribes to Blotter, queries HMM **/infer**, evaluates policy and guardrails, calls Broker.

- **Reports (web + REST)** → `web/reports`  
  Next.js dashboard + minimal REST (`/trades`, `/positions`, `/health`, `/export`).

- **Strategies A/B/C** → `strategies/*`  
  Each strategy is a config + policy wrapper around Algo/HMM (thresholds, execution style). Only one active at a time; others can shadow‑run.

- **Instrument API** → `instrument/*`  
  Helpers for symbol handling and common feature math: mid, spread(bp), OFI, imbalance, microprice, rolling vol.

- **HMM Service (ML)** → `ml-service/*`  
  FastAPI endpoints: `/train`, `/partial_fit`, `/infer`, `/health`. Stores models in `models/` and exposes versioning metadata.

- **Shadow Simulator** → `services/shadow/*`  
  Queue‑aware virtual fills driven by L2 book/trades; reconciles against paper fills.

---

## 2) Interfaces (Stable Contracts)
Keep these frozen; they’re the glue between teams and tools.

### 2.1 Blotter → Algo (streamed 20–50Hz)
```
Tick {
  ts: number,             // epoch seconds
  mid: number,
  spreadBp: number,
  imb: number,            // [-1..1] order book imbalance
  depth: Array<[price, size]>?, // top levels optional
  trades?: Array<{px:number, size:number, side:'BUY'|'SELL'}>
  features: number[]      // standardized vector used by HMM
}
```

### 2.2 Algo → HMM
- `POST /infer {symbol, features[], ts}` → `{state, probs[], action, confidence}`
- `POST /partial_fit {symbol, features: number[][]}` → `{ok}`
- `POST /train {symbol, dateRange?}` → `{ok, modelVersion}`

### 2.3 Algo → Broker
- `place({side, qty, type:'MKT'|'LMT', price?, tif?})` → `{orderId}`
- `cancel(orderId)` → `{ok}`
- `flatten(symbol)` → `{ok}`

### 2.4 Broker → Reports
- `Fill {orderId, ts, px, qty, kind:'paper'|'live', venue}`
- `Position {symbol, qty, avgPx}`

### 2.5 Shadow Sim Inputs
- `onBook(bids: [px,sz][], asks: [px,sz][])`
- `onTrade(px:number, size:number, aggressor:'BUY'|'SELL')`

---

## 3) Guardrails (must pass before any order)
- **Spread gate:** `spreadBp <= cfg.maxSpreadBp`
- **Position cap:** `abs(currentPos + orderQty) <= cfg.maxPosition`
- **Cooldown:** `now - lastFlip >= cfg.cooldownMs`
- **Latency breaker:** rolling p95 order→fill <= `cfg.latencyMsLimit`
- **Drawdown cap:** intraday PnL >= `-cfg.maxDD`
- **Kill switch:** global `TRADING_ENABLED` flag must be true

Log **reason codes** on every block (`SPREAD`, `POS`, `COOLDOWN`, `LATENCY`, `DD`, `KILL`).

---

## 4) Milestones, Deliverables, Acceptance Criteria

### M1 — Local Pipeline (Week 1)
- **Deliverables:** Blotter with mock ticks; Algo calls `/infer`; Broker simulates orders; UI shows ticks/states/trades.
- **Acceptance:** Run 1 hour locally with no crashes; CSV export works; guardrails block obviously bad trades.

### M2 — Historical Model (Week 2)
- **Deliverables:** Historical fetcher; features; `/train` builds baseline model; `/infer` stable on historical windows.
- **Acceptance:** Model loads and infers on held‑out day with no NaNs; state distribution looks sensible (not all one state).

### M3 — Paper Trading (Week 3–4)
- **Deliverables:** IBKR bridge streaming L2/trades; paper orders routed; shadow sim reconciles fills.
- **Acceptance:** Full market session (≥3h) without manual intervention; positions never exceed caps; latency metrics logged.

### M4 — NJ VPS Staging (Week 5)
- **Deliverables:** Stack deployed via Docker on NJ VPS; secure access; overnight paper session; basic monitoring.
- **Acceptance:** No container restarts, no SSE disconnect storms, logs clean; daily data/model backups produced.

### M5 — Guardrails & Runbook (Week 6)
- **Deliverables:** Kill switch; flatten procedure; runbook with exact commands; alerting on disconnect/latency/DD.
- **Acceptance:** Dry‑run recovery to flat in <30s; deliberate guardrail violations are blocked and logged.

### M6 — Live Cutover (Week 7+)
- **Deliverables:** `TRADING_MODE=live`; tiny size (1 share) for 2 days; gradual scale plan.
- **Acceptance:** Live fills match expectations; no unintended positions; DD breaker never breached; logs + PnL verified.

---

## 5) Work Breakdown (Who does what next)

### Blotter Team
- Normalize IBKR L2 → unified `Tick`.
- Compute features (imbalance, OFI, microprice delta, vol).
- Feed SSE + Shadow Sim.

### ML Team
- Feature standardization (per‑session mean/var).
- HMM config (K=3–5); `/train`, `/partial_fit`, `/infer`.
- Versioning + model metadata (date, symbol, feature schema).

### Algo/Strategy Team
- Policy mapping: `(state, confidence, spread, imb) → (action, qty, price)`.
- Cooldown + position scheduling (reduce/invert logic).
- Shadow trading for non‑active strategies.

### Broker/Risk Team
- Guardrails implementation + reason codes.
- IBKR paper/live endpoints; cancel‑all/flatten utilities.
- Latency measurement and logging.

### Reports/Ops Team
- Dashboard tiles: health, latency, DD, connection status.
- REST exports; daily CSV/Parquet rollups.
- Runbook + monitoring + backups.

---

## 6) Operational Runbook (Quick Reference)

**Start (paper):** enable `TRADING_ENABLED=true`, start containers, verify `/health` for ML & IBKR bridge, open Reports dashboard.  
**Stop:** flip kill switch; `flatten(symbol)`; verify positions = 0; stop containers.  
**Recover:** restart services; reload latest model; reconnect IBKR; verify heartbeat pings.  
**Backups:** nightly copy of models & trade logs; weekly VPS snapshot.  
**Alerts:** disconnect > 60s, latency p95 > limit for 5 min, DD breach, position > cap.

---

## 7) Risks & Mitigations
- **Paper≠Live:** Use shadow fills; start live at 1 share; review slippage daily.  
- **Model drift intraday:** Partial fits every 5–15s; cap state changes; monitor state entropy.  
- **Connectivity hiccups:** Heartbeats + auto‑reconnect; pause trading on stale data.  
- **SSE/HMR glitches in dev:** Use stable dev server; server‑side pings and hardened SSE.  
- **Operational error:** Runbook drills; require manual resume after breaker trips.

---

## 8) Definition of Done (project)
- End‑to‑end live pipeline on NJ VPS with HMM‑driven actions.  
- Guardrails enforce safety; kill switch works.  
- Daily backups; monitoring in place.  
- Documented procedures in repo; another engineer can run it unaided.

---

## 9) Handover Notes for Future AI/Engineer
- Respect **interfaces** in Section 2; changing schemas requires bumping model version + UI handlers.
- Prefer **small, frequent releases**: finish one milestone, tag, then proceed.
- Keep **reason codes** and **metrics**—they’re your black box flight recorder.
- When in doubt: pause trading, flatten, investigate, resume.
