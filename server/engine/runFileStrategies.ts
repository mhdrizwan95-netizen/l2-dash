// Register ts-node if invoked via node; harmless under ts-node
try { require("ts-node/register"); } catch {}
import fs from "fs";
import path from "path";

// Types only (erased at runtime)
type StrategyDefinition = import("../../strategies/types").StrategyDefinition;
// Runtime load via CommonJS require (avoids ESM cross-compat issues)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadStrategies } = require("../../strategies/loader");

type Fill = import("../../strategies/types").TradeSignal & { value: number; fee: number; pnl?: number };
type SessionLog = {
  session: "file-strategies";
  dateUTC: string;
  fills: Fill[];
  totals: { grossRealized: number; fees: number; netPnL: number };
};

function calcPnL(fills: Fill[]) {
  const bySym: Record<string, { pos: number; avg: number; realized: number }> = {};
  let fees = 0;
  for (const f of fills) {
    fees += f.fee;
    const s = f.symbol;
    bySym[s] ||= { pos: 0, avg: 0, realized: 0 };
    const sideMult = f.side === "BUY" ? 1 : -1;

    if (sideMult === -1 && bySym[s].pos > 0) {
      const qtyClose = Math.min(bySym[s].pos, f.qty);
      const pnl = (f.price - bySym[s].avg) * qtyClose;
      bySym[s].realized += pnl;
      bySym[s].pos -= qtyClose;
    }
    if (sideMult === 1) {
      const totalCost = bySym[s].avg * bySym[s].pos + f.price * f.qty;
      bySym[s].pos += f.qty;
      bySym[s].avg = bySym[s].pos > 0 ? totalCost / bySym[s].pos : 0;
    }
  }
  const grossRealized = Object.values(bySym).reduce((a,b)=>a+b.realized,0);
  return { grossRealized, fees, netPnL: grossRealized - fees };
}

(async function main() {
  const now = new Date();
  const isoDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const dateUTC = isoDate.slice(0,10);


  const strategies: StrategyDefinition[] = await loadStrategies("strategies");
  if (strategies.length === 0) {
    console.error("No strategies loaded. Add .strategy.ts files under strategies/.");
    process.exit(2);
  }

  // Load param overrides if present
  let paramOverrides: Record<string, any> = {};
  const paramsPath = path.join("strategies", "params.json");
  if (fs.existsSync(paramsPath)) {
    try {
      paramOverrides = JSON.parse(fs.readFileSync(paramsPath, "utf8"));
    } catch {}
  }

  const fills: Fill[] = [];
  for (const s of strategies) {
    const params = { ...s.ui.defaults, ...(paramOverrides[s.id] || {}) };
    const sigs = await s.generateSignals(params, isoDate);
    for (const k of sigs) {
      const fee = 1.00;
      fills.push({ ...k, value: k.price * k.qty * (k.side === "BUY" ? -1 : 1), fee });
    }
  }

  const totals = calcPnL(fills);

  const log: SessionLog = { session: "file-strategies", dateUTC, fills, totals };
  const outFile = path.join(path.resolve("sessions"), `${dateUTC}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(log, null, 2), "utf8");

  console.log("=== File Strategies Run ===");
  console.log(`Date (UTC): ${dateUTC}`);
  console.log(`Strategies: ${strategies.length}`);
  console.log(`Fills: ${fills.length}`);
  console.log(`Gross Realized: ${totals.grossRealized.toFixed(2)}`);
  console.log(`Fees: ${totals.fees.toFixed(2)}`);
  console.log(`Net PnL: ${totals.netPnL.toFixed(2)}`);
  console.log(`Session file: sessions/${dateUTC}.json`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
