'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStrategyStore, type StrategySlot } from '@/lib/strategyStore';
import { useUniverseData } from '@/hooks/useUniverse';
import { useStrategies } from '@/hooks/useStrategies';
import { StrategyPicker } from './StrategyPicker';
import { ParamsForm } from './ParamsForm';

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function formatCountdown(ms: number | null): string {
  if (ms === null) return '—';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours}h ${remMinutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'green' | 'amber' | 'red' }) {
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium';
  const palette = {
    default: 'bg-zinc-800 text-zinc-200',
    green: 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40',
    amber: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
    red: 'bg-rose-600/20 text-rose-200 border border-rose-500/40',
  } as const;
  return <span className={`${base} ${palette[tone]}`}>{children}</span>;
}

export function StrategyCard({ slot }: { slot: StrategySlot }) {
  const { data, loading, error, countdowns } = useUniverseData();
  const setSettings = useStrategyStore((state) => state.setSettings);
  const tradingEnabled = useStrategyStore((state) => state.settings.tradingEnabled);
  const updateSlot = useStrategyStore((state) => state.updateSlot);
  const setSlotParam = useStrategyStore((state) => state.setSlotParam);

  const { strategies } = useStrategies();
  const file = strategies.find((s) => s.id === slot.strategyId) || null;

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [flattening, setFlattening] = useState(false);

  useEffect(() => {
    if (!slot.autoManaged) return;
    const symbols = data.activeSymbols?.map((item) => item.symbol) ?? [];
    if (symbols.length === 0) return;
    if (!arraysEqual(slot.symbols || [], symbols)) {
      updateSlot(slot.id, { symbols });
    }
  }, [data.activeSymbols, slot.autoManaged, slot.id, slot.symbols, updateSlot]);

  const statusBadge = useMemo(() => {
    if (!tradingEnabled) {
      return <Badge tone="amber">Paused</Badge>;
    }
    const active = data.activeSymbols?.some((item) => item.traded);
    if (active) return <Badge tone="green">Trading</Badge>;
    if ((data.activeSymbols?.length ?? 0) > 0) return <Badge>Armed</Badge>;
    return <Badge>Idle</Badge>;
  }, [data.activeSymbols, tradingEnabled]);

  const modeBadge = <Badge>{slot.mode === 'live' ? 'Live' : 'Paper'}</Badge>;

  async function handleToggleTrading() {
    setSettings({ tradingEnabled: !tradingEnabled });
  }

  async function handleFlattenAll() {
    try {
      setFlattening(true);
      await fetch('/api/flatten', { method: 'POST' });
    } catch (err) {
      console.error('flatten failed', err);
    } finally {
      setFlattening(false);
    }
  }

  const activeSymbols = data.activeSymbols ?? [];
  const todayTop = data.todayTop10 ?? [];
  const intersection = data.intersection ?? [];
  const retired = data.retiredSymbols ?? [];

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-800 bg-[#0d101a] p-5 text-sm text-zinc-200">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">HMM Strategy</h2>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Regime-aware trading using Hidden Markov states.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {modeBadge}
          {statusBadge}
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-500">
            <span>Trading Controls</span>
            <span className="text-zinc-400">Next refresh: {formatCountdown(countdowns.nextRefreshMs)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={handleToggleTrading}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tradingEnabled ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'}`}
            >
              Trading Enabled: {tradingEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={handleFlattenAll}
              disabled={flattening}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${flattening ? 'bg-zinc-800 text-zinc-500' : 'bg-rose-600 hover:bg-rose-500 text-white'}`}
            >
              {flattening ? 'Flattening…' : 'Flatten All'}
            </button>
            <div className="rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
              Next churn window in {formatCountdown(countdowns.nextChurnMs)}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-black/20 p-4 text-xs text-zinc-400">
          <div>Models READY: {data.readyCount ?? 0}/{data.modelsRequired ?? 10}</div>
          <div>Universe last update: {formatCountdown(countdowns.lastUpdatedMs)} ago</div>
          {(data.missingModels?.length ?? 0) > 0 ? (
            <div className="mt-2 text-amber-300">
              Missing models: {data.missingModels?.join(', ')}
            </div>
          ) : null}
          {error ? <div className="mt-2 text-rose-400">{error}</div> : null}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-black/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Active Symbols (Auto)</h3>
          <span className="text-xs text-zinc-500">Traded: YES/NO · Reason shows blocks</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {activeSymbols.length === 0 && !loading && (
            <div className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-500">
              Waiting for screener refresh…
            </div>
          )}
          {activeSymbols.map((item) => (
            <div key={item.symbol} className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
              <div className="flex items-center justify-between text-sm font-medium text-white">
                <span>{item.symbol}</span>
                <Badge tone={item.traded ? 'green' : 'amber'}>{item.traded ? 'YES' : 'NO'}</Badge>
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                <div>Status: {item.status ?? 'kept'}</div>
                {item.reason ? <div>Reason: {item.reason}</div> : <div>Ready for execution</div>}
              </div>
            </div>
          ))}
        </div>
        {retired.length > 0 ? (
          <div className="mt-3 text-xs text-zinc-500">
            Retired after flat: {retired.map((entry) => entry.symbol).join(', ')}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-black/10 p-4">
          <h3 className="text-sm font-semibold text-white">Today Top 10 (Dollar Volume)</h3>
          <div className="mt-3 space-y-2">
            {todayTop.map((item, idx) => (
              <div key={item.symbol ?? idx} className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950/70 px-3 py-2">
                <div className="flex items-center gap-3 text-sm font-medium text-white">
                  <span className="text-xs text-zinc-500">#{idx + 1}</span>
                  <span>{item.symbol}</span>
                </div>
                <div className="text-xs text-zinc-400">
                  ${item.dollarVolume?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            ))}
            {todayTop.length === 0 && !loading ? (
              <div className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-500">
                No screener data yet.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-black/10 p-4">
          <h3 className="text-sm font-semibold text-white">Universe Intersection</h3>
          <div className="mt-3 space-y-2 text-xs text-zinc-400">
            {intersection.map((item) => (
              <div key={item.symbol} className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950/70 px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-white">{item.symbol}</span>
                  <Badge tone={item.ready ? 'green' : 'red'}>{item.ready ? 'READY' : 'PENDING'}</Badge>
                </div>
                <div className="text-right">
                  <div>${item.dollarVolume?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  {item.reason ? <div className="text-rose-400">{item.reason}</div> : null}
                </div>
              </div>
            ))}
            {intersection.length === 0 && !loading ? (
              <div className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-500">
                Waiting for screener…
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-900 bg-black/20 p-4">
        <button
          onClick={() => setAdvancedOpen((prev) => !prev)}
          className="text-xs font-semibold uppercase tracking-wide text-zinc-400"
        >
          {advancedOpen ? 'Hide Advanced Controls' : 'Show Advanced Controls'}
        </button>
        {advancedOpen && (
          <div className="mt-3 space-y-4">
            <div className="space-y-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Execution Mode</div>
                <div className="mt-2 flex gap-2 text-xs">
                  <button
                    onClick={() => updateSlot(slot.id, { mode: 'paper' })}
                    className={`rounded-lg px-3 py-2 font-medium transition ${slot.mode === 'paper' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/50' : 'bg-zinc-900 text-zinc-400 border border-zinc-700'}`}
                  >
                    Paper
                  </button>
                  <button
                    onClick={() => {
                      if (slot.mode === 'live') return;
                      const confirmed = window.confirm('Switch to LIVE mode? Ensure sizing + guardrails are verified.');
                      if (confirmed) updateSlot(slot.id, { mode: 'live' });
                    }}
                    className={`rounded-lg px-3 py-2 font-medium transition ${slot.mode === 'live' ? 'bg-rose-600/20 text-rose-200 border border-rose-500/50' : 'bg-zinc-900 text-zinc-400 border border-zinc-700'}`}
                  >
                    Live
                  </button>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Strategy Policy</div>
                <div className="mt-2">
                  <StrategyPicker
                    value={slot.strategyId}
                    onChange={(id) => updateSlot(slot.id, { strategyId: id, paramOverrides: {} })}
                  />
                </div>
              </div>
            </div>
            {file ? (
              <div>
                <ParamsForm
                  file={file}
                  values={slot.paramOverrides}
                  onChange={(key, value) => setSlotParam(slot.id, key, value)}
                />
              </div>
            ) : (
              <div className="text-xs text-zinc-500">Pick a strategy to adjust policy parameters.</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
