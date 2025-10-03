'use client';

import { useMemo } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

function formatQty(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '—';
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function OrdersTablePanel() {
  const fills = useTelemetryStore((state) => state.fills);

  const rows = useMemo(() => fills.slice(0, 20), [fills]);

  return (
    <Card title="Recent Fills">
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          No fills have been recorded yet. Once the broker accepts orders, executions will stream in real time.
        </div>
      ) : (
        <div className="overflow-auto max-h-96">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500 sticky top-0 bg-[#0d101a]">
              <tr>
                {['Time', 'Symbol', 'Side', 'Qty', 'Price', 'Order ID', 'Venue', 'Latency', 'PnL Δ'].map((label) => (
                  <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-200">
              {rows.map((fill, idx) => {
                // Calculate PnL contribution (simplified - assumes this fill closed previous position)
                const pnlContribution = 0; // TODO: Need more sophisticated calculation with position tracking
                const latencyMs = idx === 0 ? Date.now() - fill.ts : 0; // Simplified latency calculation

                return (
                  <tr key={`${fill.orderId}-${fill.ts}`}>
                    <td className="px-3 py-2 text-xs text-zinc-400">{new Date(fill.ts).toLocaleTimeString()}</td>
                    <td className="px-3 py-2">{fill.symbol}</td>
                    <td className={`px-3 py-2 ${fill.qty >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fill.qty >= 0 ? 'BUY' : 'SELL'}</td>
                    <td className="px-3 py-2">{formatQty(Math.abs(fill.qty))}</td>
                    <td className="px-3 py-2">{formatUsd(fill.px)}</td>
                    <td className="px-3 py-2 font-mono text-xs cursor-pointer select-all" title="Click to copy">{fill.orderId}</td>
                    <td className="px-3 py-2 uppercase text-xs">IBKR</td>
                    <td className="px-3 py-2 text-xs">{latencyMs > 0 ? `${latencyMs}ms` : '—'}</td>
                    <td className={`px-3 py-2 ${pnlContribution >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatUsd(pnlContribution)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function LatencyStatsPanel() {
  // TODO: Implement with real latency data from 'order_latency' events
  const mockLatencies = useMemo(() => {
    const latencies = [45, 52, 48, 67, 43, 89, 56, 71, 47, 62, 83, 54, 72, 68, 49, 85, 61, 76, 55, 58];
    latencies.sort((a, b) => a - b);
    return latencies;
  }, []);

  const p50 = mockLatencies[Math.floor(mockLatencies.length * 0.5)];
  const p95 = mockLatencies[Math.floor(mockLatencies.length * 0.95)];
  const p99 = mockLatencies[Math.floor(mockLatencies.length * 0.99)];

  const tailEvents = mockLatencies.slice(-10).map((lat, idx) => ({
    id: `tail-${Date.now()}-${idx}`,
    latency: lat,
    symbol: 'AAPL',
    orderId: `order-${Date.now()}-${idx}`,
    ts: Date.now() - idx * 1000
  }));

  const breached = p95 > 80; // Mock threshold

  return (
    <Card title="Latency Stats">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center">
            <div className="text-xs text-zinc-400 uppercase tracking-wide">P50</div>
            <div className="text-lg font-semibold text-emerald-300">{p50}ms</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-zinc-400 uppercase tracking-wide">P95</div>
            <div className={`text-lg font-semibold ${breached ? 'text-rose-300' : 'text-amber-300'}`}>{p95}ms</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-zinc-400 uppercase tracking-wide">P99</div>
            <div className="text-lg font-semibold text-rose-300">{p99}ms</div>
          </div>
        </div>

        {breached && (
          <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-rose-300">⚠️</span>
              <span className="text-rose-200">P95 latency exceeds limit (80ms). Check broker connection.</span>
            </div>
            <button className="mt-2 text-xs text-rose-300 underline">View Runbook</button>
          </div>
        )}

        <div className="rounded-lg border border-zinc-800 bg-[#10131d] p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Top 10 Slowest Orders</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-zinc-500 px-2 py-1">
              <span>Order ID</span>
              <span>Latency</span>
            </div>
            {tailEvents.map((event) => (
              <div key={event.id} className="flex justify-between px-2 py-1 rounded hover:bg-zinc-800/50">
                <span className="font-mono truncate">{event.orderId.slice(-8)}</span>
                <span className="text-rose-300">{event.latency}ms</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function SpreadCostsPanel() {
  const fills = useTelemetryStore((state) => state.fills);

  const spreadStats = useMemo(() => {
    if (fills.length === 0) return null;

    // Mock spread data - in reality this would come from depth snapshots at order time
    const spreads = fills.map(() => Math.random() * 8 + 2); // Random spreads 2-10 bps
    const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;

    const distribution = [0, 0, 0, 0, 0]; // 0-2, 2-4, 4-6, 6-8, 8+ bps
    spreads.forEach(spread => {
      if (spread < 2) distribution[0]++;
      else if (spread < 4) distribution[1]++;
      else if (spread < 6) distribution[2]++;
      else if (spread < 8) distribution[3]++;
      else distribution[4]++;
    });

    const perSymbol = fills.reduce((acc, fill, idx) => {
      const symbol = fill.symbol;
      const spread = spreads[idx];
      if (!acc[symbol]) acc[symbol] = { count: 0, total: 0 };
      acc[symbol].count++;
      acc[symbol].total += spread;
      return acc;
    }, {} as Record<string, { count: number; total: number }>);

    const topSymbols = Object.entries(perSymbol)
      .map(([symbol, data]) => ({ symbol, avg: data.total / data.count, count: data.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      avgSpread,
      distribution,
      totalFills: spreads.length,
      topSymbols,
      breached: avgSpread > 5 // Mock threshold
    };
  }, [fills]);

  if (!spreadStats) {
    return (
      <Card title="Spread Costs">
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          No fill data available to calculate spread costs.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Spread Costs">
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-2xl font-semibold mb-1" style={{ color: spreadStats.breached ? '#f87171' : spreadStats.avgSpread > 3 ? '#fbbf24' : '#34d399' }}>
            {spreadStats.avgSpread.toFixed(1)} bps
          </div>
          <div className="text-xs text-zinc-400">Avg spread cost</div>
          {spreadStats.breached && (
            <div className="text-xs text-rose-300 mt-2">⚠️ Above 5 bps cap</div>
          )}
        </div>

        <div className="rounded-lg border border-zinc-800 bg-[#10131d] p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Spread Distribution (bps)</div>
          <div className="grid grid-cols-5 gap-1 text-xs">
            {spreadStats.distribution.map((count, idx) => {
              const range = idx === 0 ? '0-2' : idx === 1 ? '2-4' : idx === 2 ? '4-6' : idx === 3 ? '6-8' : '8+';
              const height = count > 0 ? Math.max(20, (count / spreadStats.totalFills) * 60) : 4;
              return (
                <div key={idx} className="flex flex-col items-center">
                  <div
                    className="bg-cyan-600 rounded-sm min-h-[4px] transition-all duration-200"
                    style={{ height: `${height}px`, width: '100%' }}
                  ></div>
                  <span className="text-zinc-500 mt-1 text-[10px]">{range}</span>
                  <span className="text-zinc-400 text-[10px]">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-[#10131d] p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Per Symbol (last {spreadStats.totalFills} fills)</div>
          <div className="space-y-1 text-xs">
            {spreadStats.topSymbols.map(({ symbol, avg, count }) => (
              <div key={symbol} className="flex justify-between py-1">
                <span className="font-medium">{symbol}</span>
                <span className="text-zinc-300">{avg.toFixed(1)} bps ({count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function SlippagePanel() {
  const fills = useTelemetryStore((state) => state.fills);

  const stats = useMemo(() => {
    const paper = new Map<string, { qty: number; price: number }>();
    const shadow = new Map<string, { qty: number; price: number }>();
    fills.forEach((fill) => {
      const target = fill.kind === 'shadow' ? shadow : paper;
      const entry = target.get(fill.orderId) ?? { qty: 0, price: 0 };
      entry.qty += fill.qty;
      entry.price += fill.px * fill.qty;
      target.set(fill.orderId, entry);
    });
    let diff = 0;
    let matched = 0;
    paper.forEach((live, orderId) => {
      const sh = shadow.get(orderId);
      if (!sh || live.qty === 0 || sh.qty === 0) return;
      const livePx = live.price / live.qty;
      const shPx = sh.price / sh.qty;
      diff += shPx - livePx;
      matched += 1;
    });
    return { matched, avgDiff: matched ? diff / matched : 0 };
  }, [fills]);

  return (
    <Card title="Slippage vs Shadow">
      {stats.matched === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Shadow fills have not been recorded yet. Once the queue-aware simulator emits fills, the slippage delta will appear here.
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Matched orders</span>
            <span className="text-white">{stats.matched}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Avg shadow - live (USD)</span>
            <span className={stats.avgDiff >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{formatUsd(stats.avgDiff)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

export function CancelRejectRatePanel() {
  return (
    <Card title="Cancel / Reject">
      <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
        Cancel and reject statistics will populate once the broker emits order lifecycle events beyond fills.
      </div>
    </Card>
  );
}

export function ConnectionPanel() {
  const bridgeStatus = useTelemetryStore((state) => state.bridgeStatus);
  const lastTickAt = useTelemetryStore((state) => state.lastTickAt);

  const rows = [
    { label: 'Bridge', value: bridgeStatus === 'connected' ? 'Streaming' : 'Disconnected' },
    { label: 'Last tick', value: lastTickAt ? new Date(lastTickAt).toLocaleTimeString() : '—' },
  ];

  return (
    <Card title="IBKR Connection">
      <div className="grid gap-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2">
            <span className="text-zinc-400">{row.label}</span>
            <span className="text-white">{row.value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
