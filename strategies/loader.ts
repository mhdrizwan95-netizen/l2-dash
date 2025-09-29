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

function isTsOrJson(file: string): boolean {
  return (file.endsWith(".ts") && !file.endsWith(".d.ts")) || file.endsWith(".json");
}

export async function loadStrategies(dir: string = path.resolve("strategies")): Promise<FileStrategy[]> {
  const list: FileStrategy[] = [];
  if (!fs.existsSync(dir)) return list;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const entry = ent.name;
    if (!isTsOrJson(entry)) continue;
    const full = path.join(dir, entry);

    if (entry.endsWith(".ts") && entry !== "loader.ts") {
      const mod = await import(path.resolve(full));
      const strat = (mod as any).default as FileStrategy | undefined;
      if (strat && strat.id && typeof strat.generateSignals === "function") list.push(strat);
    } else if (entry.endsWith(".json")) {
      type JsonSignal = { date?: string; time?: string; symbol?: string; price?: number|string; qty?: number|string; side?: TradeSide; };
      type JsonStrat  = { id: string; description?: string; signals: JsonSignal[]; };
      const raw = JSON.parse(fs.readFileSync(full, "utf8")) as Partial<JsonStrat>;
      if (!raw?.id || !Array.isArray(raw?.signals)) continue;

      list.push({
        id: raw.id,
        describe: () => raw.description ?? "json-strategy",
        async generateSignals(isoDate: string) {
          const d = isoDate.slice(0,10);
          return (raw.signals ?? [])
            .filter(s => !s.date || s.date === d)
            .map(s => ({
              time: s.time ?? new Date().toISOString(),
              symbol: s.symbol ?? "DEMO",
              price: Number(s.price ?? 100),
              qty: Number(s.qty ?? 1),
              side: (s.side ?? "BUY") as TradeSide
            }));
        }
      } as FileStrategy);
    }
  }
  return list;
}
