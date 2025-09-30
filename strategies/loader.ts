import fs from "fs";
import path from "path";

export type TradeSide = "BUY" | "SELL";
export interface TradeSignal {
  time: string;   // ISO
  symbol: string;
  price: number;
  qty: number;
  side: TradeSide;
}
export interface FileStrategy {
  id: string;
  describe(): string;
  generateSignals(isoDate: string): Promise<TradeSignal[]>;
}


function isStrategyModule(file: string): boolean {
  return file.endsWith('.strategy.ts');
}


export async function loadStrategies(dir: string = path.resolve("strategies")): Promise<any[]> {
  const list: any[] = [];
  if (!fs.existsSync(dir)) return list;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const entry = ent.name;
    if (!isStrategyModule(entry)) continue;
    const full = path.join(dir, entry);
    const mod = await import(path.resolve(full));
    const strat = (mod as any).default;
    // If the module exports an array (signals-adapter), flatten it
    if (Array.isArray(strat)) {
      for (const s of strat) {
        if (s && s.id && s.ui && typeof s.generateSignals === "function") list.push(s);
      }
    } else if (strat && strat.id && strat.ui && typeof strat.generateSignals === "function") {
      list.push(strat);
    }
  }
  return list;
}
