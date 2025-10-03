'use client';

import { useMemo, useEffect, useRef } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTelemetryStore, type ExtendedTelemetry } from '@/lib/telemetryStore';
import { useDashboardStore, TIME_RANGES } from '@/lib/dashboardStore';

interface TickHistoryPoint {
  ts: number;
  price: number;
}

const EMPTY_HISTORY: TickHistoryPoint[] = [];

export function PerformanceChart({ symbol }: { symbol?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;

    const ro = new ResizeObserver(() => {
      // Chart resizes automatically with ResponsiveContainer
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const timeRange = useDashboardStore((state) => state.timeRange);
  const setTimeRange = useDashboardStore((state) => state.setTimeRange);
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const activeSymbol = symbol ?? selectedSymbol ?? null;
  const entry = useTelemetryStore((state) => (activeSymbol ? (state as ExtendedTelemetry).ticks?.[activeSymbol] ?? null : null));
  const history = entry?.history ?? EMPTY_HISTORY;

  const data = useMemo(() => {
    if (!history.length) return [] as Array<{ date: string; value: number }>;
    const cutoff = timeRange.ms === Infinity ? 0 : Date.now() - timeRange.ms;
    const filtered = history.filter((point: TickHistoryPoint) => point.ts >= cutoff);
    const target = filtered.length ? filtered : history;
    return target.map((point: TickHistoryPoint) => ({
      date: new Date(point.ts).toLocaleTimeString(),
      value: point.price,
    }));
  }, [history, timeRange.ms]);

  return (
    <div className="flex flex-col h-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 overflow-hidden">
      <div className="flex-shrink-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Price History</h2>
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            {activeSymbol ? `${activeSymbol} · real-time feed` : 'Select a symbol to plot'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIME_RANGES.map((option) => (
            <button
              key={option.id}
              onClick={() => setTimeRange(option.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
                option.id === timeRange.id ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 mt-4 min-h-0">
        <div className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="perf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={32} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 12 }} tickLine={false} axisLine={false} domain={['dataMin', 'dataMax']} />
              <Tooltip contentStyle={{ background: '#09090b', borderRadius: 12, border: '1px solid #27272a', color: '#f4f4f5' }} />
              <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2} fill="url(#perf)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
