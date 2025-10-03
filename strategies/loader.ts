import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

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
  return file.endsWith('.strategy.js');
}


export async function loadStrategies(dir: string = path.resolve("strategies")): Promise<any[]> {
  const list: any[] = [];
  if (!fs.existsSync(dir)) return list;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const entry = ent.name;
    if (!isStrategyModule(entry)) continue;
    if (process.env.NODE_ENV !== 'production') {
      console.log('[strategies] inspecting', entry);
    }

    // Always load the compiled .js version (Option B)
    const base = entry.replace(/\.strategy\.(ts|js)$/, '');
    const jsFile = path.join(dir, `${base}.strategy.js`);
    if (!fs.existsSync(jsFile)) {
      // If the .js artifact is missing, skip; caller should run build:strategies first
      continue;
    }

    try {
      const mod = await import(/* webpackIgnore: true */ pathToFileURL(jsFile).href);
      const stratModule = (mod as any).default ?? mod;
      const strat = (stratModule as any).default ?? stratModule;
    // If the module exports an array (signals-adapter), flatten it
      if (Array.isArray(strat)) {
        for (const s of strat) {
          if (s && s.id && s.ui && typeof s.generateSignals === "function") list.push(s);
        }
      } else if (strat && strat.id && strat.ui && typeof strat.generateSignals === "function") {
        list.push(strat);
      }
    } catch (error) {
      console.error('[strategies] failed to load', jsFile, error);
    }
  }
  return list;
}
