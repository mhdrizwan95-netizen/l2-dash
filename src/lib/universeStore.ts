'use client';

import { create } from 'zustand';

export type TopSymbol = {
  symbol: string;
  dollarVolume: number;
  totalTrades?: number;
  avgSpreadBp?: number;
  lastSeen?: string;
};

export type ActiveSymbol = {
  symbol: string;
  traded: boolean;
  reason?: string | null;
  status?: string;
};

export type IntersectionEntry = {
  symbol: string;
  ready: boolean;
  reason?: string | null;
  dollarVolume?: number;
};

export type UniverseState = {
  ts: string | null;
  todayTop10: TopSymbol[];
  activeSymbols: ActiveSymbol[];
  retiredSymbols?: { symbol: string; status?: string }[];
  intersection: IntersectionEntry[];
  readyModels: string[];
  readyCount: number;
  modelsRequired?: number;
  missingModels?: string[];
  nextRefreshTs: string | null;
  nextChurnTs: string | null;
  lastScreenerTs?: string | null;
};

type StoreState = {
  data: UniverseState;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
  setData: (data: UniverseState) => void;
  setLoading: (value: boolean) => void;
  setError: (reason: string | null) => void;
};

const emptyState: UniverseState = {
  ts: null,
  todayTop10: [],
  activeSymbols: [],
  intersection: [],
  readyModels: [],
  readyCount: 0,
  missingModels: [],
  nextRefreshTs: null,
  nextChurnTs: null,
};

export const useUniverseStore = create<StoreState>((set) => ({
  data: emptyState,
  loading: false,
  error: null,
  lastFetched: null,
  setData: (data) => set({ data, loading: false, error: null, lastFetched: Date.now() }),
  setLoading: (value) => set({ loading: value }),
  setError: (reason) => set({ error: reason, loading: false }),
}));

export async function fetchUniverseState(): Promise<UniverseState> {
  const res = await fetch('/api/universe', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`failed to load universe state (${res.status})`);
  }
  return res.json();
}
