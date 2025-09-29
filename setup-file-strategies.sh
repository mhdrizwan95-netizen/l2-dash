#!/usr/bin/env bash
set -euo pipefail

# --- Guards & setup -----------------------------------------------------------
if [ ! -f package.json ]; then
  echo "Run this from your project root (where package.json lives)."
  exit 1
fi

mkdir -p strategies strategies/signals sessions server/engine server/reports .github/workflows

# --- Dependencies -------------------------------------------------------------
# Keep it lean; rely on ts-node/typescript only.
npm pkg set type="module" >/dev/null 2>&1 || true
npm pkg set scripts.strategies:run="ts-node --compiler-options '{\"module\":\"CommonJS\"}' server/engine/runFileStrategies.ts" >/dev/null
npm pkg set scripts.report:files:daily="ts-node --compiler-options '{\"module\":\"CommonJS\"}' server/reports/reportDailyFromFiles.ts" >/dev/null

# Install local dev deps if missing
need_tsnode=1; need_ts=1
jq -e '.devDependencies["ts-node"]' package.json >/dev/null 2>&1 && need_tsnode=0 || true
jq -e '.devDependencies["typescript"]' package.json >/dev/null 2>&1 && need_ts=0 || true
if [ "$need_tsnode" -eq 1 ] || [ "$need_ts" -eq 1 ]; then
  npm i -D ts-node typescript >/dev/null
fi

# Create a basic tsconfig if none
if [ ! -f tsconfig.json ]; then
  cat > tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["server/**/*.ts", "strategies/**/*.ts"]
}
EOF
fi

# --- Strategy interface + loader ---------------------------------------------
cat > strategies/loader.ts <<'EOF'
import fs from "fs";
import path from "path";

export type TradeSide = "BUY" | "SELL";
export interface TradeSignal {
  time: string;         // ISO time
  symbol: string;
  price: number;
  qty: number;
  side: TradeSide;
}

export interface FileStrategy {
  id: string;
  describe(): string;
  // For demo purposes, strategies can just emit signals without market data
  generateSignals(isoDate: string): Promise<TradeSignal[]>;
}

function isTsOrJson(file: string) {
  return file.endsWith(".ts") || file.endsWith(".json");
}

export async function loadStrategies(dir = path.resolve("strategies")): Promise<FileStrategy[]> {
  const entries = fs.readdirSync(dir);
  const list: FileStrategy[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      // Recurse only into simple subfolders like strategies/signals
      continue;
    }
    if (!isTsOrJson(entry)) continue;

    if (entry.endsWith(".ts") && entry !== "loader.ts") {
      // Dynamic import of TS using ts-node register hook (runner sets it up)
      const mod = await import(path.resolve(full));
      const strat: FileStrategy | undefined = mod.default;
      if (strat && strat.id && typeof strat.generateSignals === "function") {
        list.push(strat);
      }
    } else if (entry.endsWith(".json")) {
      // JSON strategy format (very simple: emits predefined signals on the given date)
      const raw = JSON.parse(fs.readFileSync(full, "utf8"));
      if (!raw?.id || !Array.isArray(raw?.signals)) continue;

      const strat: FileStrategy = {
        id: raw.id,
        describe: () => raw.description || "json-strategy",
        async generateSignals(isoDate: string) {
          // Filter by date if "date" present; else emit all
          return raw.signals
            .filter((s: any) => !s.date || s.date === isoDate.slice(0,10))
            .map((s: any) => ({
              time: s.time || new Date().toISOString(),
              symbol: s.symbol || "DEMO",
              price: Number(s.price || 100),
              qty: Number(s.qty || 1),
              side: (s.side || "BUY") as TradeSide,
            }));
        }
      };
      list.push(strat);
    }
  }
  return list;
}
EOF

# --- Example TS strategy (emits a tiny PnL so reports aren't flat) -----------
cat > strategies/example.ma.ts <<'EOF'
import { FileStrategy, TradeSignal } from "./loader";

const strat: FileStrategy = {
  id: "example-moving-average-demo",
  describe() {
    return "Emits a BUY then a SELL next minute for small positive PnL.";
  },
  async generateSignals(isoDate: string): Promise<TradeSignal[]> {
    const base = new Date(isoDate);
    const t1 = new Date(base.getTime() + 60_000).toISOString();
    const t2 = new Date(base.getTime() + 120_000).toISOString();
    return [
      { time: t1, symbol: "DEMO", price: 100.00, qty: 1, side: "BUY"  },
      { time: t2, symbol: "DEMO", price: 101.10, qty: 1, side: "SELL" }
    ];
  }
};

export default strat;
EOF

# --- Runner: executes strategies, writes sessions/YYYY-MM-DD.json ------------
cat > server/engine/runFileStrategies.ts <<'EOF'
// Register ts-node for strategy TS imports (when executed via ts-node, this is harmless)
try { require("ts-node/register"); } catch {}
import fs from "fs";
import path from "path";
import { loadStrategies, TradeSignal } from "../../strategies/loader";

type Fill = TradeSignal & { value: number, fee: number, pnl?: number };
type SessionLog = {
  session: "file-strategies";
  dateUTC: string; // YYYY-MM-DD
  fills: Fill[];
  totals: { grossRealized: number; fees: number; netPnL: number };
};

function todayUTCDateString(d = new Date()): string {
  const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  return iso.slice(0,10);
}

function calcPnL(fills: Fill[]): { grossRealized: number; fees: number; netPnL: number } {
  // Simple average-price PnL by symbol, flat by end of day
  const bySym: Record<string, { pos: number, avg: number, realized: number }> = {};
  let fees = 0;
  for (const f of fills) {
    fees += f.fee;
    const s = f.symbol;
    bySym[s] ||= { pos: 0, avg: 0, realized: 0 };
    const sideMult = f.side === "BUY" ? 1 : -1;
    // If closing trades exist, realize PnL
    if (sideMult === -1 && bySym[s].pos > 0) {
      // Sell against long
      const qtyClose = Math.min(bySym[s].pos, f.qty);
      const pnl = (f.price - bySym[s].avg) * qtyClose;
      bySym[s].realized += pnl;
      bySym[s].pos -= qtyClose;
      // Remaining SELL beyond position ignored in this toy example
    } else if (sideMult === 1 && bySym[s].pos < 0) {
      // Buy against short (not implemented in toy)
    }
    // Update average on buys
    if (sideMult === 1) {
      const totalCost = bySym[s].avg * bySym[s].pos + f.price * f.qty;
      bySym[s].pos += f.qty;
      bySym[s].avg = bySym[s].pos > 0 ? totalCost / bySym[s].pos : 0;
    }
  }
  const grossRealized = Object.values(bySym).reduce((a,b)=>a+b.realized,0);
  return { grossRealized, fees, netPnL: grossRealized - fees };
}

async function main() {
  const now = new Date();
  const isoDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const dateUTC = isoDate.slice(0,10);

  const strategies = await loadStrategies("strategies");
  if (strategies.length === 0) {
    console.error("No strategies loaded. Add .ts or .json files under strategies/.");
    process.exit(2);
  }

  const fills: Fill[] = [];
  for (const s of strategies) {
    const sigs = await s.generateSignals(isoDate);
    for (const k of sigs) {
      // Flat fee and simple value calc; adjust as needed
      const fee = 1.00;
      fills.push({ ...k, value: k.price * k.qty * (k.side === "BUY" ? -1 : 1), fee });
    }
  }

  // Realized PnL marking (toy: mark-on-close when SELL happens)
  // Tag pnl per SELL vs average (calculated in calcPnL aggregate)
  const totals = calcPnL(fills);

  const log: SessionLog = {
    session: "file-strategies",
    dateUTC,
    fills,
    totals
  };

  const outDir = path.resolve("sessions");
  const outFile = path.join(outDir, `${dateUTC}.json`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(log, null, 2), "utf8");

  console.log("=== File Strategies Run ===");
  console.log(`Date (UTC): ${dateUTC}`);
  console.log(`Strategies: ${strategies.length}`);
  console.log(`Fills: ${fills.length}`);
  console.log(`Gross Realized: ${totals.grossRealized.toFixed(2)}`);
  console.log(`Fees: ${totals.fees.toFixed(2)}`);
  console.log(`Net PnL: ${totals.netPnL.toFixed(2)}`);
  console.log(`Session file: sessions/${dateUTC}.json`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
EOF

# --- Daily report that reads sessions/YYYY-MM-DD.json -------------------------
cat > server/reports/reportDailyFromFiles.ts <<'EOF'
import fs from "fs";
import path from "path";

function todayUTCDateString(d = new Date()): string {
  const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  return iso.slice(0,10);
}

function readSession(dateUTC: string) {
  const p = path.resolve("sessions", `${dateUTC}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  const dateUTC = todayUTCDateString();
  const s = readSession(dateUTC);

  console.log("=== Daily Report (File Strategies) ===");
  console.log(`Date (UTC): ${dateUTC}`);

  if (!s) {
    console.log("No session file found. Run: npm run strategies:run");
    process.exit(0);
  }

  const fills = s.fills || [];
  console.log(`Fills today: ${fills.length}`);
  console.log(`Gross Realized: ${(s.totals?.grossRealized ?? 0).toFixed(2)}`);
  console.log(`Fees: ${(s.totals?.fees ?? 0).toFixed(2)}`);
  console.log(`Net PnL: ${(s.totals?.netPnL ?? 0).toFixed(2)}`);
}

main();
EOF

# --- Seed a JSON strategy (optional) -----------------------------------------
cat > strategies/demo.json <<'EOF'
{
  "id": "json-demo-strategy",
  "description": "Emits a single BUY/SELL pair at small profit",
  "signals": [
    { "time": "2025-09-29T09:01:00.000Z", "symbol": "DEMOJ", "price": 50.0, "qty": 1, "side": "BUY"  },
    { "time": "2025-09-29T09:02:00.000Z", "symbol": "DEMOJ", "price": 50.7, "qty": 1, "side": "SELL" }
  ]
}
EOF

# --- Optional: CI workflow ----------------------------------------------------
cat > .github/workflows/ci.yml <<'EOF'
name: CI
on:
  pull_request:
    branches: [ main ]
  push:
    branches: [ main ]
jobs:
  build-test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npm run build --if-present
      - run: npm -s run strategies:run || true
      - run: npm -s run report:files:daily || true
EOF

# --- Optional: Codex configuration -------------------------------------------
mkdir -p .github
cat > .github/codex.yml <<'EOF'
models:
  default: "gpt-5"
limits:
  max_changed_files: 50
  max_diff_bytes: 300000
paths:
  include:
    - "server/**"
    - "strategies/**"
    - "sessions/**"
  exclude:
    - "node_modules/**"
    - "dist/**"
guardrails:
  require_review_from_codeowners: true
  allow_force_push: false
  allow_secrets_access: false
style:
  language: "typescript"
  package_manager: "npm"
context:
  readme: true
  run_tests: true
EOF

# --- Optional: basic CODEOWNERS ----------------------------------------------
cat > CODEOWNERS <<'EOF'
* @muhammed-rizwan
strategies/* @muhammed-rizwan
EOF

# --- Done --------------------------------------------------------------------
echo
echo "Setup complete."
echo "Run the pipeline:"
echo "  1) npm run strategies:run"
echo "  2) npm run report:files:daily"
echo
echo "You should see a non-zero Gross/Net PnL in the report (toy BUY/SELL)."
