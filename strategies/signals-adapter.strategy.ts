import fs from "fs";
import path from "path";
import { StrategyDefinition, TradeSignal } from "./types";

// Adapter: exposes all *.signals.json as test strategies
function loadSignalJsonFiles(dir: string = path.resolve("strategies")) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(".signals.json"))
    .map(f => path.join(dir, f));
}

const adapters: StrategyDefinition[] = loadSignalJsonFiles().map((file) => {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const id = raw.id || path.basename(file, ".signals.json");
  const name = raw.description || id;
  const signals: TradeSignal[] = (raw.signals || []).map((s: any) => ({
    time: s.time ?? new Date().toISOString(),
    symbol: s.symbol ?? "DEMO",
    price: Number(s.price ?? 100),
    qty: Number(s.qty ?? 1),
    side: (s.side ?? "BUY") as "BUY" | "SELL",
  }));
  return {
    id,
    name: `[signals] ${name}`,
    ui: {
      schema: {},
      defaults: {},
    },
    async generateSignals(_params, isoDate) {
      const d = isoDate.slice(0, 10);
      return signals.filter(s => !s.time || s.time.startsWith(d));
    },
    describe: () => `Adapter for ${file}`,
  };
});

export default adapters;
