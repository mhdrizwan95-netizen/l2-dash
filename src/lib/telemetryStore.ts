import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { makeRafBatcher } from './rafBatch';

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
