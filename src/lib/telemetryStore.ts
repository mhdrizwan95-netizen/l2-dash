import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { makeRafBatcher } from './rafBatch';

// Shared immutable empty arrays/objects to avoid unnecessary re-renders
const EMPTY_ARR: TickData[] = [];
const DEFAULT_WATCHLIST = ['AAPL','GOOGL','MSFT','TSLA','NVDA','META'];

// Define proper types for telemetry data
export type TickData = Array<{ ts: number; price: number }>;
export type PositionData = { qty: number; avgPx: number; realizedPnL: number };
export type FillData = { orderId: string; px: number; qty: number; ts: number; symbol: string; kind?: string };
export type GuardrailData = { id: string; rule: string; severity: 'block' | 'warn'; ts: number; symbol?: string };

export type ExtendedTelemetry = Telemetry & {
  watchlist?: string[];
  activeSymbol?: string | null;
  ticks?: Record<string, TickData & { price: number; ts: number; history: TickData }>;
  positions?: Record<string, PositionData>;
  fills?: FillData[];
  guardrails?: GuardrailData[];
  guardrailStore?: unknown;
};

type Telemetry = {
  focused: string | null;
  hbAgeMs: number;
  inferP95: number;
  execP95: number;
  lastTickTs?: number;
  // ...add what *UI needs*, not raw messages
  setPatch: (p: Partial<Telemetry>) => void;
};

export const useTelemetry = create<Telemetry>()(
  subscribeWithSelector((set) => ({
    focused: null,
    hbAgeMs: 0,
    inferP95: 0,
    execP95: 0,
    setPatch: (p) => set(p),
  }))
);

export const scheduleTelemetry = makeRafBatcher<Telemetry>(
  (p) => useTelemetry.getState().setPatch(p)
);

// Backward compatibility - keep old exports for now
export const useTelemetryStore = useTelemetry;

// Safe, selector-based subscriptions (prevents re-render storms + guards undefined)
export const useActiveSymbol = () =>
  useTelemetryStore(s => (s as ExtendedTelemetry).activeSymbol ?? (s as ExtendedTelemetry).watchlist?.[0] ?? DEFAULT_WATCHLIST[0]);

export const useActiveTicks = () =>
  useTelemetryStore(s => {
    const sym = (s as ExtendedTelemetry).activeSymbol ?? (s as ExtendedTelemetry).watchlist?.[0] ?? DEFAULT_WATCHLIST[0];
    return (s as ExtendedTelemetry).ticks?.[sym] ?? EMPTY_ARR;
  });

export const useTicksFor = (sym?: string | null) =>
  useTelemetryStore(s => ((s as ExtendedTelemetry).ticks?.[sym ?? ''] ?? EMPTY_ARR));
