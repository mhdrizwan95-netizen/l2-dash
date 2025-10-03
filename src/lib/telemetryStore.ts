import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { makeRafBatcher } from './rafBatch';

// Shared immutable empty arrays/objects to avoid unnecessary re-renders
const EMPTY_ARR: any[] = [];
const DEFAULT_WATCHLIST = ['AAPL','GOOGL','MSFT','TSLA','NVDA','META'];

type ExtendedTelemetry = Telemetry & {
  watchlist?: string[];
  ticks?: Record<string, any>;
  positions?: Record<string, any>;
  fills?: any[];
  guardrails?: any[];
  guardrailStore?: any;
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
