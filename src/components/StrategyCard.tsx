// src/components/StrategyCard.tsx
'use client';

import { useMemo } from 'react';
import { useStrategyStore, type Strategy } from '@/lib/strategyStore';
import { useEventStream } from '@/hooks/useEventStream';

export function StrategyCard({ strat }: { strat: Strategy }) {
  const update = useStrategyStore((s) => s.updateStrategy);
  const remove = useStrategyStore((s) => s.removeStrategy);
  const evt = useEventStream<any>('/api/stream');

  // latest markov payload for this symbol
  const markov = useMemo(() => {
    if (evt?.type === 'markov' && evt?.payload?.symbol === strat.symbol) return evt.payload;
    return null;
  }, [evt, strat.symbol]);

  const next = (markov?.next as [number, number, number] | undefined) ?? undefined;
  const topIdx = next ? next.indexOf(Math.max(...next)) : null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm uppercase tracking-wider text-zinc-400">Strategy</div>
          <div className="text-lg font-semibold">{strat.name}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => update(strat.id, { running: !strat.running })}
            className={`px-3 py-1.5 rounded-lg ${
              strat.running ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {strat.running ? 'Stop' : 'Start'}
          </button>
          <button
            onClick={() => remove(strat.id)}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Inputs */}
      <div className="px-4 grid grid-cols-3 gap-3 text-sm">
        <label className="col-span-1">
          Symbol
          <input
            value={strat.symbol}
            onChange={(e) => update(strat.id, { symbol: e.target.value.toUpperCase() })}
            className="mt-1 w-full bg-zinc-800 rounded-lg p-2"
            placeholder="AAPL"
          />
        </label>
        <label className="col-span-1">
          Risk per trade (%)
          <input
            type="number"
            value={strat.riskPct}
            onChange={(e) => update(strat.id, { riskPct: parseFloat(e.target.value || '0') })}
            className="mt-1 w-full bg-zinc-800 rounded-lg p-2"
          />
        </label>
        <label className="col-span-1">
          Order Size
          <input
            type="number"
            value={strat.size}
            onChange={(e) => update(strat.id, { size: parseInt(e.target.value || '0') })}
            className="mt-1 w-full bg-zinc-800 rounded-lg p-2"
          />
        </label>
      </div>

      {/* Next-state odds */}
      <div className="p-4">
        <div className="text-xs text-zinc-400 mb-2">Next-state odds for {strat.symbol || '—'}</div>
        {next ? (
          <div className="grid grid-cols-3 gap-2">
            {(['Down', 'Flat', 'Up'] as const).map((label, i) => (
              <div
                key={label}
                className={`rounded-lg p-2 ${
                  topIdx === i ? 'bg-emerald-600/20 border border-emerald-600/40' : 'bg-zinc-800'
                }`}
              >
                <div className="text-xs text-zinc-400">{label}</div>
                <div className="text-lg font-semibold">{(next[i] * 100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-zinc-500 text-sm">Waiting for data…</div>
        )}
      </div>

      {/* Report snapshot */}
      <div className="px-4 pb-4 grid grid-cols-4 gap-3 text-sm">
        <Metric label="PnL" value={fmtMoney(strat.report.pnl)} />
        <Metric label="Win %" value={fmtPct(strat.report.winRate)} />
        <Metric label="# Trades" value={String(strat.report.trades)} />
        <Metric label="Max DD" value={fmtPct(strat.report.maxDD)} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function fmtMoney(x: number) {
  const sign = x >= 0 ? '+' : '';
  return `${sign}${x.toFixed(2)}`;
}

function fmtPct(x: number) {
  return isFinite(x) ? (x * 100).toFixed(1) + '%' : '—';
}
