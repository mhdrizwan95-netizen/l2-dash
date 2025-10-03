'use client';
import { create } from 'zustand';
import type { BridgeSettings } from '@/lib/settingsSchema';
import { defaultBridgeSettings, normalizeBridgeSettings } from '@/lib/settingsSchema';

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
  paramOverrides: Record<string, unknown>; // per-slot overrides of file defaults
  report: StrategyReport;
  autoManaged: boolean;
  mode: 'paper' | 'live';
};

export type Settings = BridgeSettings;

interface StrategyStoreData {
  settings: Settings;
  slots: StrategySlot[];
}

const STORAGE_KEY = 'l2dash_store_v3';

const uid = (): string =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(16).slice(2) + Date.now().toString(16);

// Strategy-specific persistence utilities
function saveStrategyStore(data: StrategyStoreData): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch (error) {
    console.warn(`Failed to save strategy store to localStorage:`, error);
  }
}

function loadStrategyStore(): StrategyStoreData | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn(`Failed to load strategy store from localStorage:`, error);
    return null;
  }
}

let symbolSyncTimer: ReturnType<typeof setTimeout> | null = null;
let lastSymbolSignature = '';
let settingsSaveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSymbolSync(symbols: string[]) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  const normalized = Array.from(new Set(symbols.map((sym) => sym.trim().toUpperCase()).filter(Boolean))).sort();
  const signature = normalized.join(',');
  if (signature === lastSymbolSignature) return;
  lastSymbolSignature = signature;
  if (symbolSyncTimer) clearTimeout(symbolSyncTimer);
  symbolSyncTimer = setTimeout(() => {
    fetch('/api/symbols', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: normalized }),
    }).catch(() => undefined);
  }, 200);
}

function scheduleSettingsSave(settings: Settings) {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  if (settingsSaveTimer) clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(() => {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    }).catch(() => undefined);
  }, 200);
}

function serializeSettings(settings: Settings): string {
  return JSON.stringify({
    host: settings.host,
    port: settings.port,
    clientId: settings.clientId,
    account: settings.account || '',
    ingestKey: settings.ingestKey || '',
    tradingEnabled: settings.tradingEnabled,
  });
}

const defaultReport = (): StrategyReport => ({
  pnl: 0,
  trades: 0,
  winRate: 0,
  maxDD: 0,
});

const defaultSettings: Settings = { ...defaultBridgeSettings };

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
  autoManaged: n === 1,
  mode: 'paper',
});

const hydrateSlot = (slot: Partial<StrategySlot> | undefined, index: number): StrategySlot => {
  if (!slot) return defaultSlot(index + 1);
  return {
    ...defaultSlot(index + 1, slot.symbols ?? []),
    ...slot,
    symbols: Array.isArray(slot.symbols) ? slot.symbols : [],
    autoManaged: slot.autoManaged ?? (index === 0),
    mode: slot.mode === 'live' ? 'live' : 'paper',
    report: slot.report ?? defaultReport(),
  } satisfies StrategySlot;
};

type Store = {
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;

  slots: StrategySlot[];
  addSlot: () => void;
  removeSlot: (id: string) => void;
  updateSlot: (id: string, patch: Partial<StrategySlot>) => void;
  setSlotParam: (id: string, key: string, value: unknown) => void;

  bootFromStorage: () => void;
};

export const useStrategyStore = create<Store>((set, get) => ({
  settings: defaultSettings,
  slots: [defaultSlot(1, ['AAPL']), defaultSlot(2, ['MSFT'])],

  setSettings: (s) => {
    const current = get().settings;
    const next: Settings = { ...current, ...s };
    set({ settings: next }, false);
    scheduleSettingsSave(next);
  },

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
      const data = loadStrategyStore();
      if (data) {
        const persistedSettings = data.settings && typeof data.settings === 'object' ? data.settings as Partial<Settings> : undefined;
        const slots = Array.isArray(data.slots) ? data.slots.map((slot, idx) => hydrateSlot(slot, idx)) : [defaultSlot(1), defaultSlot(2)];
        set({
          settings: { ...defaultSettings, ...(persistedSettings ?? {}) },
          slots,
        });
      }
    } catch { /* ignore */ }

    if (typeof fetch === 'function') {
      fetch('/api/settings', { cache: 'no-store' })
        .then(res => (res.ok ? res.json() : null))
        .then((server) => {
          if (!server) return;
          const current = get().settings;
          const serverSettings = normalizeBridgeSettings(server as Partial<Settings>);
          const defaultSignature = serializeSettings(defaultSettings);
          const serverSignature = serializeSettings(serverSettings);
          const currentSignature = serializeSettings(current);

          if (serverSignature === defaultSignature && currentSignature !== defaultSignature) {
            scheduleSettingsSave(current);
            return;
          }

          if (serverSignature !== currentSignature) {
            set({ settings: serverSettings }, false);
          }
        })
        .catch(() => undefined);
    }

    const initialSymbols = Array.from(new Set(get().slots.flatMap((slot) => slot.symbols || [])));
    scheduleSymbolSync(initialSymbols);
    useStrategyStore.subscribe((st) => {
      saveStrategyStore({ settings: st.settings, slots: st.slots });
      const symbols = Array.from(new Set(st.slots.flatMap((slot) => slot.symbols || [])));
      scheduleSymbolSync(symbols);
    });
  },
}));
