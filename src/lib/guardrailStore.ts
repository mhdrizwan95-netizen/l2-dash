import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { GuardrailCode } from './contracts';
import { makeRafBatcher } from './rafBatch';

export type GuardCode = GuardrailCode;

type GuardEvent = {
  ts: number;
  symbol: string;
  reason: GuardCode;
  detail?: string;
};

type GuardState = {
  latest?: GuardEvent;
  counters: Partial<Record<GuardCode, number>>;
  log: GuardEvent[];
  setPatch: (p: Partial<GuardState>) => void;
  pushEvent: (e: GuardEvent) => void;
};

export const useGuardrails = create<GuardState>()(
  subscribeWithSelector((set, get) => ({
    counters: {},
    log: [],
    setPatch: (p) => set(p),
    pushEvent: (e) => {
      const counters = { ...get().counters, [e.reason]: (get().counters[e.reason] ?? 0) + 1 };
      const log = [e, ...get().log].slice(0, 500);
      set({ latest: e, counters, log });
    },
  }))
);

export const scheduleGuardrails = makeRafBatcher<GuardState>(
  (p) => useGuardrails.getState().setPatch(p)
);
