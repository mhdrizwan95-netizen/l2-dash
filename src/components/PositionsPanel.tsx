'use client';

import { useMemo } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

export function PositionsPanel() {
  const positions = useTelemetryStore((state) => state.positions);
  const ticks = useTelemetryStore((state) => state.ticks);

  const rows = useMemo(() => {
    return Object.values(positions).map((pos) => {
      const last = ticks[pos.symbol]?.price ?? 0;
      const unrealized = (last - pos.avgPx) * pos.qty;
      return {
        symbol: pos.symbol,
        qty: pos.qty,
        avgPx: pos.avgPx,
        last,
        unrealized,
      };
    });
  }, [positions, ticks]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Open Positions ({rows.length})
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Symbol</th>
              <th className="px-4 py-2 text-right font-medium">Qty</th>
              <th className="px-4 py-2 text-right font-medium">Avg Px</th>
              <th className="px-4 py-2 text-right font-medium">Last</th>
              <th className="px-4 py-2 text-right font-medium">Unrealized</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-center text-zinc-500" colSpan={5}>
                  Flat — no positions on book
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.symbol} className="border-t border-zinc-800 text-white">
                  <td className="px-4 py-2 font-medium">{row.symbol}</td>
                  <td className="px-4 py-2 text-right">{row.qty.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{row.avgPx.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{row.last ? row.last.toFixed(2) : '—'}</td>
                  <td className={`px-4 py-2 text-right ${row.unrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {row.unrealized >= 0 ? '+' : '-'}${Math.abs(row.unrealized).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
