'use client';

import { useMemo } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';
import { useDashboardStore, TIME_RANGES } from '@/lib/dashboardStore';
import { formatUsd } from './SymbolOverviewGrid';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export function SymbolDetailPanel() {
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const timeRange = useDashboardStore((state) => state.timeRange);
  const setTimeRange = useDashboardStore((state) => state.setTimeRange);
  const selectedSymbols = useDashboardStore((state) => state.selectedSymbols);
  const setSelectedSymbol = useDashboardStore((state) => state.setSelectedSymbol);
  const tickEntry = useTelemetryStore((state) => (selectedSymbol ? (state as any).ticks?.[selectedSymbol] ?? null : null));
  const positions = useTelemetryStore((state) => state.positions);
  const fills = useTelemetryStore((state) => state.fills);
  const guardrails = useTelemetryStore((state) => state.guardrails);

  const history = useMemo(() => {
    if (!tickEntry) return [];
    const cutoff = timeRange.ms === Infinity ? 0 : Date.now() - timeRange.ms;
    return tickEntry.history.filter((point) => point.ts >= cutoff).map((point) => ({
      ts: new Date(point.ts).toLocaleTimeString(),
      price: point.price,
    }));
  }, [tickEntry, timeRange.ms]);

  const position = selectedSymbol ? positions[selectedSymbol] : undefined;
  const exposure = position && tickEntry ? position.qty * tickEntry.price : 0;
  const latestTrades = useMemo(() => {
    if (!selectedSymbol) return [];
    return fills.filter((f) => f.symbol === selectedSymbol).slice(0, 6);
  }, [fills, selectedSymbol]);
  const latestAlerts = useMemo(() => {
    if (!selectedSymbol) return [];
    return guardrails.filter((g) => !g.symbol || g.symbol === selectedSymbol).slice(0, 6);
  }, [guardrails, selectedSymbol]);

  if (!selectedSymbol || !tickEntry) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-[#0d101a] p-6 text-sm text-zinc-400">
        Select a symbol to view detailed telemetry.
      </div>
    );
  }

  const ageSeconds = (Date.now() - tickEntry.ts) / 1000;

  return (
    <div className="flex flex-col h-full rounded-xl border border-zinc-800 bg-[#0d101a] p-6 overflow-hidden">
      <div className="flex-shrink-0 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-500">Selected Symbol</div>
          <div className="text-2xl font-semibold text-white">{selectedSymbol}</div>
          <div className="text-sm text-zinc-400">${tickEntry.price.toFixed(2)} · {ageSeconds.toFixed(1)}s ago</div>
        </div>
        <div className="flex flex-col gap-2">
          {selectedSymbols.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {selectedSymbols.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => setSelectedSymbol(symbol)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    symbol === selectedSymbol ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {symbol}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
          {TIME_RANGES.map((range) => (
            <button
              key={range.id}
              onClick={() => setTimeRange(range.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                range.id === timeRange.id ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {range.label}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6 pr-2">

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 16, right: 16, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`detail-${selectedSymbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="ts" tick={{ fill: '#a1a1aa', fontSize: 11 }} minTickGap={48} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} axisLine={false} tickLine={false} domain={['dataMin', 'dataMax']} />
            <Tooltip contentStyle={{ background: '#090b11', border: '1px solid #272936', borderRadius: 12 }} />
            <Area type="monotone" dataKey="price" stroke="#34d399" fill={`url(#detail-${selectedSymbol})`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-[#0f141d] p-4">
          <div className="text-xs uppercase tracking-widest text-zinc-500">Position Stats</div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-400">Quantity</dt>
              <dd className="text-white">{position ? position.qty.toFixed(2) : '0.00'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Avg Price</dt>
              <dd className="text-white">{position ? `$${position.avgPx.toFixed(2)}` : '$0.00'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Exposure</dt>
              <dd className={exposure >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{formatUsd(exposure)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-400">Realized PnL</dt>
              <dd className={position && position.realizedPnL >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{formatUsd(position?.realizedPnL ?? 0)}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-[#0f141d] p-4">
          <div className="text-xs uppercase tracking-widest text-zinc-500">Recent Guardrails</div>
          {latestAlerts.length === 0 ? (
            <div className="mt-3 text-sm text-zinc-400">No guardrail activity.</div>
          ) : (
            <ul className="mt-3 space-y-2 text-sm text-zinc-200">
              {latestAlerts.map((alert) => (
                <li key={alert.id} className="flex items-baseline justify-between gap-3">
                  <span className="text-zinc-400">{new Date(alert.ts).toLocaleTimeString()}</span>
                  <span className={alert.severity === 'block' ? 'text-rose-300' : alert.severity === 'warn' ? 'text-amber-300' : 'text-sky-300'}>{alert.rule}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-[#0f141d] p-4">
        <div className="text-xs uppercase tracking-widest text-zinc-500">Recent Trades</div>
        {latestTrades.length === 0 ? (
          <div className="mt-3 text-sm text-zinc-400">No executions for this symbol.</div>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="text-left">Time</th>
                <th className="text-left">Side</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Price</th>
                <th className="text-left">Type</th>
              </tr>
            </thead>
            <tbody>
              {latestTrades.map((trade) => (
                <tr key={trade.orderId} className="border-t border-zinc-800 text-zinc-200">
                  <td>{new Date(trade.ts).toLocaleTimeString()}</td>
                  <td className={trade.qty >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{trade.qty >= 0 ? 'BUY' : 'SELL'}</td>
                  <td className="text-right">{Math.abs(trade.qty).toFixed(2)}</td>
                  <td className="text-right">${trade.px.toFixed(2)}</td>
                  <td>{trade.kind ?? 'fill'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      </div>
    </div>
  );
}
