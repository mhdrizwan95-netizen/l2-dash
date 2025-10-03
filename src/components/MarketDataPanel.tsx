'use client';

import { useMemo } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

export function MarketDataPanel() {
  const ticks = useTelemetryStore((state) => state.ticks);

  const rows = useMemo(() => {
    return Object.values(ticks).map((entry) => {
      const change = entry.price - entry.firstPrice;
      const pct = entry.firstPrice ? (change / entry.firstPrice) * 100 : 0;
      return {
        symbol: entry.symbol,
        last: entry.price,
        change,
        pct,
        observations: entry.history.length,
      };
    });
  }, [ticks]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Market Data</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Symbol</th>
              <th className="px-4 py-2 text-right font-medium">Last</th>
              <th className="px-4 py-2 text-right font-medium">Change</th>
              <th className="px-4 py-2 text-right font-medium">Change %</th>
              <th className="px-4 py-2 text-right font-medium">Samples</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-zinc-500">Waiting for ticks…</td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.symbol} className="border-t border-zinc-800 text-white">
                  <td className="px-4 py-2 font-medium">{row.symbol}</td>
                  <td className="px-4 py-2 text-right">${row.last.toFixed(2)}</td>
                  <td className={`px-4 py-2 text-right ${row.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {row.change >= 0 ? '+' : ''}{row.change.toFixed(2)}
                  </td>
                  <td className={`px-4 py-2 text-right ${row.pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {row.pct >= 0 ? '+' : ''}{row.pct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-2 text-right">{row.observations}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
