// src/lib/strategyStore.ts
'use client';
import { create } from 'zustand';

export type Strategy = {
  id: string;
  name: string;
  symbol: string;
  running: boolean;
  riskPct: number; // percent of equity risked per trade
  size: number;    // units / shares
  report: { pnl: number; trades: number; winRate: number; maxDD: number };
};

export type Settings = {
  host: string;
  port: number;
  clientId: number;
  account?: string;
  ingestKey?: string;
};

const defaultSettings: Settings = { host: '127.0.0.1', port: 7497, clientId: 42 };

type Store = {
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;

  strategies: Strategy[];
  addStrategy: () => void;
  removeStrategy: (id: string) => void;
  updateStrategy: (id: string, patch: Partial<Strategy>) => void;

  bootFromStorage: () => void;
};

export const useStrategyStore = create<Store>((set, get) => ({
  settings: defaultSettings,

  setSettings: (s) =>
    set({ settings: { ...get().settings, ...s } }, false, 'setSettings'),

  strategies: [makeStrat(1), makeStrat(2)],

  addStrategy: () =>
    set((state) => ({
      strategies: [
        ...state.strategies,
        makeStrat(state.strategies.length + 1),
      ],
    })),

  removeStrategy: (id) =>
    set((state) => ({
      strategies: state.strategies.filter((s) => s.id !== id),
    })),

  updateStrategy: (id, patch) =>
    set((state) => ({
      strategies: state.strategies.map((s) =>
        s.id === id ? { ...s, ...patch } : s
      ),
    })),

  bootFromStorage: () => {
    try {
      const raw = localStorage.getItem('l2dash_store');
      if (raw) {
        const parsed = JSON.parse(raw);
        // basic shape guard
        if (parsed.settings && parsed.strategies) {
          set(parsed);
        }
      }
    } catch {
      /* ignore */
    }
    // persist on every change
    const unsub = useStrategyStore.subscribe((st) => {
      try {
        localStorage.setItem(
          'l2dash_store',
          JSON.stringify({ settings: st.settings, strategies: st.strategies })
        );
      } catch {
        /* ignore */
      }
    });
    // If you ever need to stop persisting:
    // (get() as any).__unsubPersist = unsub;
  },
}));

function makeStrat(n: number): Strategy {
  return {
    id: crypto.randomUUID(),
    name: `Strategy ${n}`,
    symbol: n === 1 ? 'AAPL' : 'MSFT',
    running: false,
    riskPct: 0.5,
    size: 100,
    report: { pnl: 0, trades: 0, winRate: NaN, maxDD: 0 },
  };
}
