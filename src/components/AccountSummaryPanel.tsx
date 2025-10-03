'use client';

import { useMemo } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const prefix = value >= 0 ? '' : '-';
  return `${prefix}$${Math.abs(value).toFixed(value >= 1000 ? 0 : 2)}`;
}

export function AccountSummaryPanel() {
  const ticks = useTelemetryStore((state) => state.ticks);
  const positions = useTelemetryStore((state) => state.positions);
  const fills = useTelemetryStore((state) => state.fills);
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const lastTickAt = useTelemetryStore((state) => state.lastTickAt);

  const { primarySymbol, price, netExposure, realizedPnL, heartbeat, tradeCount, guardrailCount } = useMemo(() => {
    const symbols = Object.values(ticks);
    const primary = symbols[0];
    const price = primary?.price ?? 0;
    const exposure = Object.values(positions).reduce((acc, pos) => {
      const last = ticks[pos.symbol]?.price ?? price;
      return acc + pos.qty * last;
    }, 0);
    const realized = Object.values(positions).reduce((acc, pos) => acc + pos.realizedPnL, 0);
    const heartbeat = lastTickAt ? Math.max(0, (Date.now() - lastTickAt) / 1000) : null;
    return {
      primarySymbol: primary?.symbol ?? '—',
      price,
      netExposure: exposure,
      realizedPnL: realized,
      heartbeat,
      tradeCount: fills.length,
      guardrailCount: guardrails.length,
    };
  }, [ticks, positions, fills.length, guardrails.length, lastTickAt]);

  return (
    <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-500">Primary Symbol</div>
          <div className="text-xl font-semibold text-white">{primarySymbol}</div>
          <div className="text-xs text-zinc-400">{price ? `$${price.toFixed(2)}` : '—'} · {heartbeat !== null ? `${heartbeat.toFixed(1)}s since last tick` : 'no stream'}</div>
        </div>
      </div>

      <div className="grid gap-3">
        <MetricRow label="Net Exposure" value={formatUsd(netExposure)} tone={netExposure >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
        <MetricRow label="Realized PnL" value={formatUsd(realizedPnL)} tone={realizedPnL >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
        <MetricRow label="Trades Recorded" value={tradeCount.toString()} tone="text-sky-300" />
        <MetricRow label="Guardrail Alerts" value={guardrailCount.toString()} tone={guardrailCount > 0 ? 'text-amber-300' : 'text-zinc-300'} />
      </div>
    </div>
  );
}

function MetricRow({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-semibold ${tone ?? 'text-white'}`}>{value}</span>
    </div>
  );
}
