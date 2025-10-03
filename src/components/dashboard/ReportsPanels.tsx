"use client";

import { useMemo, useState } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';
import { formatUsd } from '../SymbolOverviewGrid';

export function DailyReportsPanel() {
  const fills = useTelemetryStore((state) => state.fills);
  const positions = useTelemetryStore((state) => state.positions);
  const ticks = useTelemetryStore((state) => state.ticks);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { tradeCount, realized, openPnL, winRate } = useMemo(() => {
    const tradeCount = fills.length;
    let realized = 0;
    let openPnL = 0;
    let wins = 0;
    let losses = 0;
    for (const pos of Object.values(positions)) {
      realized += pos.realizedPnL;
      const tick = ticks[pos.symbol];
      if (tick && pos.qty !== 0) {
        openPnL += (tick.price - pos.avgPx) * pos.qty;
      }
      if (pos.realizedPnL > 0) wins += 1;
      else if (pos.realizedPnL < 0) losses += 1;
    }
    const totalClosed = wins + losses;
    const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;
    return { tradeCount, realized, openPnL, winRate };
  }, [fills, positions, ticks]);

  const netPnL = realized + openPnL;

  const exportFile = async (format: 'csv' | 'parquet' | 'json') => {
    setDownloading(format);
    try {
      const dateStr = selectedDate.toISOString().slice(0, 10);
      const res = await fetch(`/api/export/trades?format=${format}&date=${dateStr}`);
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trades-${dateStr}.${format === 'json' ? 'json' : format === 'parquet' ? 'parquet' : 'csv'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`[reports] ${format} export failed`, err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card title="Daily PnL Reports">
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <label htmlFor="report-date" className="text-xs text-zinc-400 uppercase tracking-wide">
              Date
            </label>
            <input
              id="report-date"
              type="date"
              value={selectedDate.toISOString().slice(0, 10)}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="rounded-lg border border-zinc-700 bg-[#10131d] px-2 py-1 text-sm text-zinc-200 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-zinc-800 bg-[#10131d] p-3 text-xs text-zinc-300">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>Trades {tradeCount}</span>
              <span>Realized {formatUsd(realized)}</span>
              <span>Open {formatUsd(openPnL)}</span>
              <span>Net {formatUsd(netPnL)}</span>
              <span>Win Rate {winRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportFile('csv')}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50"
            disabled={downloading !== null || tradeCount === 0}
          >
            {downloading === 'csv' ? 'Preparing…' : 'Export CSV'}
          </button>
          <button
            onClick={() => exportFile('parquet')}
            className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
            disabled={downloading !== null || tradeCount === 0}
          >
            {downloading === 'parquet' ? 'Preparing…' : 'Export Parquet'}
          </button>
          <button
            onClick={() => exportFile('json')}
            className="rounded-lg border border-purple-400/40 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-purple-200 hover:bg-purple-500/20 disabled:opacity-50"
            disabled={downloading !== null || tradeCount === 0}
          >
            {downloading === 'json' ? 'Preparing…' : 'Export JSON'}
          </button>
        </div>
      </div>
    </Card>
  );
}

export function SessionSummaryPanel() {
  const positions = useTelemetryStore((state) => state.positions);
  const ticks = useTelemetryStore((state) => state.ticks);

  const { pnl, topWinners, topLosers } = useMemo(() => {
    const winners: Array<{ symbol: string; value: number }> = [];
    const losers: Array<{ symbol: string; value: number }> = [];
    let total = 0;
    for (const pos of Object.values(positions)) {
      const last = ticks[pos.symbol]?.price ?? pos.avgPx;
      const open = (last - pos.avgPx) * pos.qty;
      const net = pos.realizedPnL + open;
      total += net;
      if (net >= 0) winners.push({ symbol: pos.symbol, value: net });
      else losers.push({ symbol: pos.symbol, value: net });
    }
    winners.sort((a, b) => b.value - a.value);
    losers.sort((a, b) => a.value - b.value);
    return {
      pnl: total,
      topWinners: winners.slice(0, 2),
      topLosers: losers.slice(0, 2),
    };
  }, [positions, ticks]);

  return (
    <Card title="Session Summary">
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between text-zinc-400">
          <span>Cumulative PnL</span>
          <span className={pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
            {formatUsd(pnl)}
          </span>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-[#10131d] p-3 text-xs text-zinc-300 space-y-1">
          <div>
            Winners:{' '}
            {topWinners.length ? topWinners.map((w) => `${w.symbol} (${formatUsd(w.value)})`).join(', ') : '—'}
          </div>
          <div>
            Losers:{' '}
            {topLosers.length ? topLosers.map((l) => `${l.symbol} (${formatUsd(l.value)})`).join(', ') : '—'}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ShadowSimPanel() {
  const fills = useTelemetryStore((state) => state.fills);

  const stats = useMemo(() => {
    const paper = new Map<string, { qty: number; notional: number }>();
    const shadow = new Map<string, { qty: number; notional: number }>();
    for (const fill of fills) {
      const target = fill.kind === 'shadow' ? shadow : paper;
      const entry = target.get(fill.orderId) ?? { qty: 0, notional: 0 };
      entry.qty += fill.qty;
      entry.notional += fill.px * fill.qty;
      target.set(fill.orderId, entry);
    }
    let matched = 0;
    let diff = 0;
    for (const [orderId, live] of paper.entries()) {
      const sh = shadow.get(orderId);
      if (!sh || sh.qty === 0 || live.qty === 0) continue;
      const livePx = live.notional / live.qty;
      const shPx = sh.notional / sh.qty;
      diff += shPx - livePx;
      matched += 1;
    }
    const avgDiff = matched > 0 ? diff / matched : 0;
    return {
      paperCount: paper.size,
      shadowCount: shadow.size,
      matched,
      avgDiff,
    };
  }, [fills]);

  return (
    <Card title="Shadow Sim vs Live">
      <div className="grid gap-3 text-sm text-zinc-300">
        <div className="flex items-center justify-between"><span>Paper fills</span><span>{stats.paperCount}</span></div>
        <div className="flex items-center justify-between"><span>Shadow fills</span><span>{stats.shadowCount}</span></div>
        <div className="flex items-center justify-between">
          <span>Matched orders</span>
          <span>{stats.matched}</span>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-[#10131d] p-3 text-xs">
          Avg shadow - live price diff: {stats.avgDiff === 0 ? '—' : stats.avgDiff.toFixed(4)}
        </div>
      </div>
    </Card>
  );
}

export function ReasonCodeLogPanel() {
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const items = useMemo(() => guardrails.slice(0, 8), [guardrails]);

  return (
    <Card title="Reason Codes">
      <div className="space-y-2 text-xs">
        {items.length === 0 && <div className="rounded-lg border border-dashed border-zinc-700/60 bg-[#10131d] px-3 py-2 text-zinc-500">No guardrail hits yet.</div>}
        {items.map((entry) => (
          <div key={entry.id} className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-rose-200">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wide">{entry.rule}</span>
              <span>{new Date(entry.ts).toLocaleTimeString()}</span>
            </div>
            <div className="text-sm text-rose-100">
              <span className="font-semibold mr-2">{entry.symbol ?? '—'}</span>
              {entry.message}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AlertsHistoryPanel() {
  const bridgeStatus = useTelemetryStore((state) => state.bridgeStatus);
  const lastTickAt = useTelemetryStore((state) => state.lastTickAt);
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const latency = useTelemetryStore((state) => state.mlLatency);
  const fills = useTelemetryStore((state) => state.fills);

  const alerts = useMemo(() => {
    const list: Array<{ message: string; type: 'info' | 'warning' | 'error'; timestamp: number; mutedUntil?: number }> = [];

    // Connection alerts
    if (bridgeStatus === 'disconnected') {
      list.push({
        message: 'IBKR bridge disconnected - orders may fail',
        type: 'error',
        timestamp: Date.now() - 60000,
        mutedUntil: Date.now() + 300000 // Muted for 5 minutes
      });
    }

    // Data freshness alerts
    if (lastTickAt) {
      const age = Date.now() - lastTickAt;
      if (age > 10000) {
        list.push({
          message: `Data stale ${Math.round(age / 1000)}s - model may be operating on old market data`,
          type: 'warning',
          timestamp: Date.now() - 12000
        });
      }
    } else {
      list.push({
        message: 'No tick data received yet - waiting for market feed',
        type: 'warning',
        timestamp: Date.now() - 10000
      });
    }

    // Latency alerts
    if (latency && latency.p95 > 80) {
      list.push({
        message: `High inference latency (P95: ${latency.p95}ms) - may impact decision speed`,
        type: 'warning',
        timestamp: Date.now() - 15000
      });
    }

    // Recent guardrail breaches
    const recentGuardrails = guardrails.filter(g => (Date.now() - g.ts) < 300000); // Last 5 minutes
    recentGuardrails.forEach(g => {
      list.push({
        message: `${g.rule} guardrail triggered: ${g.message}${g.symbol ? ` (${g.symbol})` : ''}`,
        type: g.severity === 'block' ? 'error' : 'warning',
        timestamp: g.ts
      });
    });

    // Fill rate alerts
    const recentFills = fills.filter(f => (Date.now() - f.ts) < 60000); // Last minute
    if (recentFills.length === 0 && bridgeStatus === 'connected') {
      list.push({
        message: 'No recent fills - check if strategy is generating orders',
        type: 'info',
        timestamp: Date.now() - 30000
      });
    }

    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [bridgeStatus, lastTickAt, guardrails, latency, fills]);

  const formatTime = (timestamp: number) => {
    const secondsAgo = Math.floor((Date.now() - timestamp) / 1000);
    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    return new Date(timestamp).toLocaleTimeString();
  };

  const getBorderColor = (type: 'info' | 'warning' | 'error') => {
    if (type === 'error') return 'border-rose-400/30 bg-rose-500/10';
    if (type === 'warning') return 'border-amber-400/30 bg-amber-500/10';
    return 'border-emerald-400/30 bg-emerald-500/10';
  };

  return (
    <Card title="Alerts History">
      <div className="space-y-2 text-xs">
        {alerts.length === 0 ? (
          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-emerald-200">
            Stream healthy - no recent alerts
          </div>
        ) : (
          alerts.map((alert, idx) => (
            <div key={idx} className={`rounded-lg border ${getBorderColor(alert.type)} px-3 py-2`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-white text-sm">{alert.message}</p>
                  <p className="text-zinc-400 mt-1">{formatTime(alert.timestamp)}</p>
                </div>
                <div className="flex gap-1">
                  {alert.type === 'warning' && (
                    <button
                      className="px-2 py-1 text-xs rounded border border-amber-400/50 text-amber-200 hover:bg-amber-400/10"
                      title="Silence this alert type for 15 minutes"
                    >
                      Mute
                    </button>
                  )}
                  {alert.type === 'error' && (
                    <button
                      className="px-2 py-1 text-xs rounded border border-rose-400/50 text-rose-200 hover:bg-rose-400/10"
                      title="Acknowledge this alert"
                    >
                      Ack
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export function GuardrailLogTable() {
  const guardrails = useTelemetryStore((state) => state.guardrails);

  if (guardrails.length === 0) {
    return <div className="text-sm text-zinc-500">No guardrail events yet.</div>;
  }

  return (
    <div className="overflow-auto max-h-72">
      <table className="min-w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-zinc-500 sticky top-0 bg-[#0d101a]">
          <tr>
            {['Timestamp', 'Symbol', 'Reason', 'Details', 'Action'].map((label) => (
              <th key={label} className="px-3 py-2 text-left font-medium">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800 text-zinc-200">
          {guardrails.map((entry) => {
            const action = entry.severity === 'block' ? 'Suppressed Order' :
                          entry.severity === 'warn' ? 'Alert Sent' : 'Logged';
            const severityColor = entry.severity === 'block' ? 'text-rose-300' :
                                 entry.severity === 'warn' ? 'text-amber-300' : 'text-emerald-300';

            return (
              <tr key={entry.id}>
                <td className="px-3 py-2 text-xs text-zinc-400">{new Date(entry.ts).toLocaleTimeString()}</td>
                <td className="px-3 py-2">{entry.symbol ?? '—'}</td>
                <td className="px-3 py-2 font-mono uppercase text-xs">{entry.rule}</td>
                <td className="px-3 py-2">{entry.message}</td>
                <td className={`px-3 py-2 text-xs ${severityColor}`}>{action}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
