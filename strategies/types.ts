export type TradeSide = "BUY" | "SELL";
export interface TradeSignal {
  time: string;   // ISO
  symbol: string;
  price: number;
  qty: number;
  side: TradeSide;
}

export type UiField =
  | { type: "number"; min?: number; max?: number; step?: number; label?: string }
  | { type: "boolean"; label?: string }
  | { type: "select"; options: string[]; label?: string }
  | { type: "text"; label?: string };

export type UiSchema = Record<string, UiField>;

export interface StrategyDefinition<P extends Record<string, any> = any> {
  id: string;
  name: string;
  ui: {
    schema: UiSchema;
    defaults: P;
  };
  describe?(params: P): string;
  generateSignals(params: P, isoDate: string): Promise<TradeSignal[]>;
}
