'use client';
import { create } from 'zustand';

export type StrategyReport = {
  pnl: number;
  trades: number;
  winRate: number; // 0..1
  maxDD: number;   // 0..1
};

export type StrategySlot = {
  id: string;
  title: string;
  strategyId: string | null;           // file-based id from /strategies/*.json
  symbols: string[];
  running: boolean;
  riskPct: number;
  size: number;
  paramOverrides: Record<string, any>; // per-slot overrides of file defaults
  report: StrategyReport;
};

export type Settings = {
  host: string;
  port: number;
  clientId: number;
  account?: string;
  ingestKey?: string;
};

const STORAGE_KEY = 'l2dash_store_v3';

const uid = (): string =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(16).slice(2) + Date.now().toString(16);

const defaultReport = (): StrategyReport => ({
  pnl: 0,
  trades: 0,
  winRate: 0,
  maxDD: 0,
});

const defaultSettings: Settings = { host: '127.0.0.1', port: 7497, clientId: 42 };

const defaultSlot = (n: number, symbols: string[] = []): StrategySlot => ({
  id: uid(),
  title: `Strategy ${n}`,
  strategyId: null,
  symbols,
  running: false,
  riskPct: 0.5,
  size: 100,
  paramOverrides: {},
  report: defaultReport(),
});

type Store = {
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;

  slots: StrategySlot[];
  addSlot: () => void;
  removeSlot: (id: string) => void;
  updateSlot: (id: string, patch: Partial<StrategySlot>) => void;
  setSlotParam: (id: string, key: string, value: any) => void;

  bootFromStorage: () => void;
};

export const useStrategyStore = create<Store>((set, get) => ({
  settings: defaultSettings,
  slots: [defaultSlot(1, ['AAPL']), defaultSlot(2, ['MSFT'])],

  setSettings: (s) => set({ settings: { ...get().settings, ...s } }, false, 'setSettings'),

  addSlot: () => set(st => ({ slots: [...st.slots, defaultSlot(st.slots.length + 1)] })),
  removeSlot: (id) => set(st => ({ slots: st.slots.filter(s => s.id !== id) })),
  updateSlot: (id, patch) =>
    set(st => ({ slots: st.slots.map(s => (s.id === id ? { ...s, ...patch } : s)) })),
  setSlotParam: (id, key, value) =>
    set(st => ({
      slots: st.slots.map(s => s.id === id ? { ...s, paramOverrides: { ...s.paramOverrides, [key]: value } } : s),
    })),

  bootFromStorage: () => {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.settings && Array.isArray(parsed.slots)) {
          set({
            settings: { ...defaultSettings, ...parsed.settings },
            slots: parsed.slots.length ? parsed.slots : [defaultSlot(1), defaultSlot(2)],
          });
        }
      }
    } catch { /* ignore */ }
    useStrategyStore.subscribe((st) => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings: st.settings, slots: st.slots }));
        }
      } catch { /* ignore */ }
    });
  },
}));
