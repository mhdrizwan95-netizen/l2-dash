'use client';

import { useMemo } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${prefix}$${Math.abs(value).toFixed(2)}`;
}

export function StrategyPerformancePanel() {
  const ticks = useTelemetryStore((state) => state.ticks);
  const positions = useTelemetryStore((state) => state.positions);
  const fills = useTelemetryStore((state) => state.fills);
  const guardrails = useTelemetryStore((state) => state.guardrails);

  const rows = useMemo(() => {
    const symbols = Object.keys(ticks);
    if (symbols.length === 0) return [] as Array<{ name: string; exposure: number; realized: number; trades: number; alerts: number; price: number }>;
    return symbols.map((symbol) => {
      const tick = ticks[symbol];
      const pos = positions[symbol];
      const exposure = pos ? pos.qty * tick.price : 0;
      const realized = pos?.realizedPnL ?? 0;
      const trades = fills.filter((f) => f.symbol === symbol).length;
      const alerts = guardrails.filter((g) => g.symbol === symbol).length;
      return {
        name: symbol,
        exposure,
        realized,
        trades,
        alerts,
        price: tick.price,
      };
    });
  }, [ticks, positions, fills, guardrails]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Strategy Snapshot
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Symbol</th>
              <th className="px-4 py-2 text-right font-medium">Last</th>
              <th className="px-4 py-2 text-right font-medium">Exposure</th>
              <th className="px-4 py-2 text-right font-medium">Realized</th>
              <th className="px-4 py-2 text-right font-medium">Trades</th>
              <th className="px-4 py-2 text-right font-medium">Alerts</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-center text-zinc-500" colSpan={6}>
                  Waiting for live ticks…
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.name} className="border-t border-zinc-800 text-white">
                  <td className="px-4 py-2 font-medium">{row.name}</td>
                  <td className="px-4 py-2 text-right">${row.price.toFixed(2)}</td>
                  <td className={`px-4 py-2 text-right ${row.exposure >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatNumber(row.exposure)}
                  </td>
                  <td className={`px-4 py-2 text-right ${row.realized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatNumber(row.realized)}
                  </td>
                  <td className="px-4 py-2 text-right">{row.trades}</td>
                  <td className="px-4 py-2 text-right">{row.alerts}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
