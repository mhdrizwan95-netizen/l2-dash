'use client';

import { useMemo } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

export function PortfolioOverview() {
  const ticks = useTelemetryStore((state) => state.ticks);
  const positions = useTelemetryStore((state) => state.positions);

  const { metrics, rows } = useMemo(() => {
    const priceBySymbol = Object.fromEntries(Object.entries(ticks).map(([symbol, entry]) => [symbol, entry.price]));
    let netExposure = 0;
    let grossExposure = 0;
    const tableRows = Object.values(positions).map((pos) => {
      const last = priceBySymbol[pos.symbol] ?? 0;
      const unrealized = (last - pos.avgPx) * pos.qty;
      netExposure += pos.qty * last;
      grossExposure += Math.abs(pos.qty * last);
      return {
        symbol: pos.symbol,
        qty: pos.qty,
        avgPx: pos.avgPx,
        last,
        unrealized,
      };
    });
    const summary = [
      { label: 'Net Exposure', value: formatUsd(netExposure) },
      { label: 'Gross Exposure', value: formatUsd(grossExposure) },
      { label: 'Positions', value: tableRows.length.toString() },
      { label: 'Active Symbols', value: Object.keys(ticks).length.toString() },
    ];
    return { metrics: summary, rows: tableRows };
  }, [ticks, positions]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="text-xs uppercase tracking-wide text-zinc-500">{metric.label}</div>
            <div className="mt-2 text-xl font-semibold text-white">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70">
        <div className="border-b border-zinc-800 px-4 py-3 text-sm font-medium uppercase tracking-wider text-zinc-400">
          Open Positions
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-900/60 text-zinc-400">
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
                    No open positions
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.symbol} className="border-t border-zinc-800 text-white">
                    <td className="px-4 py-2 font-semibold">{row.symbol}</td>
                    <td className="px-4 py-2 text-right">{row.qty.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{row.avgPx.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{row.last ? row.last.toFixed(2) : '—'}</td>
                    <td className={`px-4 py-2 text-right ${row.unrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatUsd(row.unrealized)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const prefix = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  return `${prefix}$${abs >= 1000 ? (abs / 1000).toFixed(1) + 'K' : abs.toFixed(2)}`;
}
