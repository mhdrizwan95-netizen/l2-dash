import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { makeRafBatcher } from './rafBatch';

type Order = {
  id: string;
  symbol: string;
  side: 'B' | 'S';
  qty: number;
  px?: number;
  status: string;
  ts: number;
};

type Fill = {
  orderId: string;
  ts: number;
  px: number;
  qty: number;
  venue?: string;
  latencyMs?: number;
};

type Position = {
  symbol: string;
  qty: number;
  avgPx: number;
};

type OrdersState = {
  orders: Record<string, Order>;
  fills: Fill[];
  positions: Record<string, Position>;
  setPatch: (p: Partial<OrdersState>) => void;
  upsertOrder: (o: Order) => void;
  pushFill: (f: Fill) => void;
};

export const useOrders = create<OrdersState>()(
  subscribeWithSelector((set, get) => ({
    orders: {},
    fills: [],
    positions: {},
    setPatch: (p) => set(p),
    upsertOrder: (o) => set((s) => ({ orders: { ...s.orders, [o.id]: o } })),
    pushFill: (f) => set((s) => ({ fills: [f, ...s.fills].slice(0, 1000) })),
  }))
);

export const scheduleOrders = makeRafBatcher<OrdersState>(
  (p) => useOrders.getState().setPatch(p)
);
