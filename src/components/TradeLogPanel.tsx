'use client';

import { useMemo } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

export function TradeLogPanel({ symbol, limit = 50 }: { symbol?: string | null; limit?: number }) {
  const fills = useTelemetryStore((state) => state.fills);

  const rows = useMemo(() => {
    let filtered = fills;
    if (symbol) {
      filtered = filtered.filter((fill) => fill.symbol === symbol);
    }
    return filtered.slice(0, limit).map((fill) => {
      const side = fill.qty >= 0 ? 'BUY' : 'SELL';
      return {
        id: fill.orderId,
        ts: new Date(fill.ts).toLocaleTimeString(),
        symbol: fill.symbol,
        side,
        qty: Math.abs(fill.qty).toFixed(2),
        price: fill.px.toFixed(2),
        status: fill.kind ? fill.kind.toUpperCase() : 'FILLED',
      };
    });
  }, [fills, limit, symbol]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70">
      <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Recent Activity</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/80 text-zinc-500">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Timestamp</th>
              <th className="px-4 py-2 text-left font-medium">Symbol</th>
              <th className="px-4 py-2 text-left font-medium">Side</th>
              <th className="px-4 py-2 text-right font-medium">Qty</th>
              <th className="px-4 py-2 text-right font-medium">Price</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-4 text-center text-zinc-500" colSpan={6}>No executions recorded.</td>
              </tr>
            ) : (
              rows.map((trade) => (
                <tr key={trade.id} className="border-t border-zinc-800 text-white">
                <td className="px-4 py-2 text-zinc-400">{trade.ts}</td>
                  <td className="px-4 py-2 font-semibold">{trade.symbol}</td>
                  <td className={`px-4 py-2 font-medium ${trade.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>{trade.side}</td>
                  <td className="px-4 py-2 text-right">{trade.qty}</td>
                  <td className="px-4 py-2 text-right">{trade.price}</td>
                  <td className="px-4 py-2 text-zinc-300">{trade.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
