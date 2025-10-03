'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { ResponsiveContainer, AreaChart, Area, Tooltip, PieChart, Pie, Cell, XAxis, YAxis } from 'recharts';
import { useTelemetryStore, type FillEntry } from '@/lib/telemetryStore';
import { useStrategyStore } from '@/lib/strategyStore';
import type { ControlChannelStatus, ControlRequest } from '@/hooks/useControlChannel';
import { formatDistanceToNow, startOfDay, startOfMonth, startOfWeek } from 'date-fns';

type TimeframeId = 'today' | 'week' | 'month';

type RealizedResult = {
  realized: number;
  timeline: { ts: string; value: number }[];
};

function computeRealizedPnL(fills: FillEntry[], startTs: number | null): RealizedResult {
  if (!fills.length) {
    return { realized: 0, timeline: [] };
  }
  const sorted = [...fills].sort((a, b) => a.ts - b.ts);
  const lots = new Map<string, { long: Array<{ qty: number; price: number }>; short: Array<{ qty: number; price: number }> }>();
  let realized = 0;
  let cumulative = 0;
  const timeline: { ts: string; value: number }[] = [];

  const isEligible = (ts: number) => (startTs === null ? true : ts >= startTs);

  const pushTimeline = (ts: number, delta: number) => {
    if (!isEligible(ts) || delta === 0) return;
    cumulative += delta;
    timeline.push({ ts: new Date(ts).toLocaleTimeString(), value: cumulative });
  };

  for (const fill of sorted) {
    const symbol = fill.symbol;
    const qty = fill.qty;
    const price = fill.px;
    const ts = fill.ts;
    let book = lots.get(symbol);
    if (!book) {
      book = { long: [], short: [] };
      lots.set(symbol, book);
    }

    if (qty > 0) {
      let remaining = qty;

      while (remaining > 0 && book.short.length > 0) {
        const lot = book.short[0]; // qty stored as negative magnitude
        const matched = Math.min(-lot.qty, remaining);
        const pnl = (lot.price - price) * matched;
        if (isEligible(ts)) {
          realized += pnl;
          pushTimeline(ts, pnl);
        }
        lot.qty += matched;
        remaining -= matched;
        if (lot.qty >= -1e-9) {
          book.short.shift();
        }
      }

      if (remaining > 0) {
        book.long.push({ qty: remaining, price });
      }
    } else if (qty < 0) {
      let remaining = -qty;

      while (remaining > 0 && book.long.length > 0) {
        const lot = book.long[0];
        const matched = Math.min(lot.qty, remaining);
        const pnl = (price - lot.price) * matched;
        if (isEligible(ts)) {
          realized += pnl;
          pushTimeline(ts, pnl);
        }
        lot.qty -= matched;
        remaining -= matched;
        if (lot.qty <= 1e-9) {
          book.long.shift();
        }
      }

      if (remaining > 0) {
        book.short.push({ qty: -remaining, price });
      }
    }
  }

  return { realized, timeline };
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

const PIE_COLORS = ['#34d399', '#f472b6', '#60a5fa', '#facc15'];

export function PnlSummaryPanel() {
  const positions = useTelemetryStore((state) => state.positions);
  const ticks = useTelemetryStore((state) => state.ticks);
  const fills = useTelemetryStore((state) => state.fills);
  const account = useTelemetryStore((state) => state.account);

  const unrealized = useMemo(() => {
    return Object.values(positions).reduce((acc, pos) => {
      const last = ticks[pos.symbol]?.price ?? pos.avgPx;
      return acc + (last - pos.avgPx) * pos.qty;
    }, 0);
  }, [positions, ticks]);

  const now = useMemo(() => new Date(), []);
  const frames: Array<{ id: TimeframeId; label: string; start: number | null }> = useMemo(
    () => [
      { id: 'today', label: 'Today', start: startOfDay(now).getTime() },
      { id: 'week', label: 'Week-to-date', start: startOfWeek(now, { weekStartsOn: 1 }).getTime() },
      { id: 'month', label: 'Month-to-date', start: startOfMonth(now).getTime() },
    ],
    [now],
  );

  const summaries = useMemo(() => {
    return frames.map((frame) => {
      const { realized, timeline } = computeRealizedPnL(fills, frame.start);
      return {
        id: frame.id,
        label: frame.label,
        realized,
        unrealized,
        net: realized + unrealized,
        timeline,
      };
    });
  }, [fills, frames, unrealized]);

  const todayTimeline = summaries.find((s) => s.id === 'today')?.timeline ?? [];
  const buyingPower = account.buyingPower || Math.abs(unrealized) * 2;
  const netLiq = account.netLiquidation || (account.cash + unrealized);

  return (
    <Card title="PnL Summary">
      <div className="grid gap-3">
        {summaries.map((summary) => (
          <div key={summary.id} className="rounded-lg border border-zinc-800 bg-[#10131d] p-3">
            <div className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-500">
              <span>{summary.label}</span>
              {summary.id === 'today' && buyingPower > 0 ? (
                <span className="text-zinc-400">BP used {(Math.min(100, Math.max(0, (Math.abs(summary.net) / buyingPower) * 100))).toFixed(1)}%</span>
              ) : summary.id === 'week' && netLiq > 0 ? (
                <span className="text-zinc-400">Return {(summary.net / netLiq * 100).toFixed(2)}%</span>
              ) : null}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1">
              <Metric label="Realized" value={formatUsd(summary.realized)} tone={summary.realized >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
              <Metric label="Unrealized" value={formatUsd(summary.unrealized)} tone={summary.unrealized >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
              <Metric label="Net" value={formatUsd(summary.net)} tone={summary.net >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 h-24 rounded-lg bg-[#131826]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={todayTimeline} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pnlSpark" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="ts" hide />
            <YAxis hide />
            <Tooltip formatter={(value: number) => formatUsd(value)} labelStyle={{ color: '#a1a1aa' }} contentStyle={{ background: '#0f121d', borderRadius: 8 }} />
            <Area type="monotone" dataKey="value" stroke="#34d399" fill="url(#pnlSpark)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function DrawdownGaugePanel() {
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const fills = useTelemetryStore((state) => state.fills);

  // Calculate intraday drawdown series
  const ddSeries = useMemo(() => {
    if (!fills.length) return [];

    const sortedFills = [...fills].sort((a, b) => a.ts - b.ts);
    let peak = 0;
    let current = 0;
    const series: Array<{ ts: string; dd: number }> = [];

    sortedFills.forEach(fill => {
      current += fill.qty * fill.px;
      peak = Math.max(peak, current);
      const drawdown = peak > 0 ? ((peak - current) / peak) * 100 : 0;
      series.push({
        ts: new Date(fill.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dd: Math.abs(drawdown)
      });
    });

    return series;
  }, [fills]);

  const ddEvent = guardrails.find((g) => g.rule === 'DD');
  const currentDD = ddEvent ? Number.parseFloat(ddEvent.message.replace(/[^\d.-]/g, '')) : 0;
  const maxDD = 5;
  const pct = Math.min(100, Math.max(0, (currentDD / maxDD) * 100));

  return (
    <Card title="Drawdown">
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className={`text-2xl font-bold ${currentDD > 3 ? 'text-rose-300' : currentDD > 1 ? 'text-amber-300' : 'text-emerald-300'}`}>
            {currentDD.toFixed(2)}%
          </span>
          <span className="text-xs text-zinc-500">Limit {maxDD.toFixed(2)}%</span>
        </div>

        <div className="space-y-2">
          <div className="h-2 w-full rounded-full bg-zinc-800">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${pct > 75 ? 'bg-rose-400' : pct > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="text-xs text-zinc-500">Progress toward limit</div>
        </div>

        {/* Intraday DD Sparkline */}
        <div className="border-t border-zinc-800 pt-3">
          <div className="text-xs text-zinc-500 mb-2">Intraday DD Trend</div>
          <div className="h-12">
            <SparklineChart data={ddSeries.map(d => ({ ts: d.ts, value: d.dd }))} color="#f87171" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ExposurePiePanel() {
  const positions = useTelemetryStore((state) => state.positions);
  const ticks = useTelemetryStore((state) => state.ticks);
  const account = useTelemetryStore((state) => state.account);

  const data = useMemo(() => {
    const exposures: Record<string, number> = {};
    Object.values(positions).forEach((pos) => {
      const last = ticks[pos.symbol]?.price ?? pos.avgPx;
      exposures[pos.symbol] = (exposures[pos.symbol] ?? 0) + pos.qty * last;
    });
    return Object.entries(exposures).map(([symbol, exposure]) => ({ name: symbol, value: Math.abs(exposure), raw: exposure }));
  }, [positions, ticks]);

  const totalExposure = data.reduce((acc, entry) => acc + entry.value, 0);
  const longExposure = data.reduce((acc, entry) => acc + Math.max(0, entry.raw), 0);
  const shortExposure = data.reduce((acc, entry) => acc + Math.min(0, entry.raw), 0);
  const buyingPower = account.buyingPower || Math.abs(totalExposure) * 2;
  const bpUsedPct = buyingPower > 0 ? Math.min(100, Math.max(0, (totalExposure / buyingPower) * 100)) : 0;

  return (
    <Card title="Exposure">
      <div className="flex flex-col h-full gap-3 py-2">
        {/* Header */}
        <div className="flex-shrink-0">
          <div className="text-xs text-zinc-400">Total Exposure</div>
          <div className="text-xl font-semibold text-white">{formatUsd(totalExposure)}</div>
        </div>

        {/* Chart and details in flexible layout */}
        <div className="flex-1 min-h-0 flex gap-3">
          <div className="flex-shrink-0 w-24 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} innerRadius={12} outerRadius={22} dataKey="value">
                  {data.map((_entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex-1 min-w-0 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            {/* Legend */}
            <ul className="space-y-1 mb-3">
              {data.map((entry, idx) => (
                <li key={entry.name} className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="truncate">{entry.name}</span>
                  <span className="ml-auto flex-shrink-0">{formatUsd(entry.value)}</span>
                </li>
              ))}
            </ul>

            {/* Stats */}
            <div className="space-y-2 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>Buying power used</span>
                <span className="font-semibold text-white">{bpUsedPct.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Long exposure</span>
                <span className="text-green-400">{formatUsd(longExposure)}</span>
              </div>
              <div className="flex justify-between">
                <span>Short exposure</span>
                <span className="text-red-400">{formatUsd(Math.abs(shortExposure))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function HmmStatePanel() {
  const markov = useTelemetryStore((state) => state.markov);
  const stateData = markov && typeof markov === 'object' ? (markov as Record<string, unknown>) : null;
  const stateLabels = ['Down', 'Flat', 'Up'];

  // Use mock data from telemetry store
  const probs = Array.isArray(stateData?.probs) ? (stateData.probs as number[]) : [0.12, 0.85, 0.03];
  const lastState = typeof stateData?.state === 'number' ? stateData.state : 1;
  const entropy = typeof stateData?.entropy === 'number' ? stateData.entropy : 0.32;
  const confidence = typeof stateData?.confidence === 'number' ? stateData.confidence : 0.85;

  const getStateColor = (state: number) => {
    switch (state) {
      case 0: return 'text-rose-300 bg-rose-500/10'; // Down - red
      case 2: return 'text-emerald-300 bg-emerald-500/10'; // Up - green
      default: return 'text-amber-300 bg-amber-500/10'; // Flat - amber
    }
  };

  const bars = probs.map((prob, idx) => ({
    label: stateLabels[idx],
    value: Math.max(prob * 100, 0.5), // Minimum bar width
    rawProb: prob,
    color: idx === lastState ? '#34d399' : '#64748b', // Green for current state, gray for others
  }));

  return (
    <Card title="Market State">
      <div className="space-y-4">
        {/* Current State & Confidence */}
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">{stateLabels[lastState]}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStateColor(lastState)}`}>
              State {lastState}
            </span>
          </div>
          <div className="text-xs text-zinc-500">
            Confidence: <span className="text-white font-medium">{(confidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* State Probability Bars */}
        <div className="space-y-3">
          {bars.map((bar, idx) => (
            <div key={bar.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-medium">{bar.label}</span>
                <span>{bar.rawProb.toFixed(2)}</span>
              </div>
              <div className="relative">
                <div className="h-2 w-full rounded-full bg-zinc-800" />
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, bar.value)}%`,
                    backgroundColor: bar.color
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Entropy Badge */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">Uncertainty</span>
          <span className={`text-xs font-medium ${entropy > 0.6 ? 'text-amber-300' : entropy > 0.3 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {entropy.toFixed(2)} {'Low Medium High'.split(' ')[Math.floor(entropy * 3)]}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function LastTradesPanel() {
  const fills = useTelemetryStore((state) => state.fills);
  const recent = useMemo(() => fills.slice(0, 5), [fills]);

  return (
    <Card title="Last Trades">
      <div className="space-y-2 text-sm">
        {recent.length === 0 && <div className="text-zinc-500">No trades yet.</div>}
        {recent.map((fill) => (
          <div key={fill.orderId} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2">
            <div>
              <div className="font-semibold text-white">{fill.symbol}</div>
              <div className="text-xs text-zinc-500">{new Date(fill.ts).toLocaleTimeString()}</div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-semibold ${fill.qty >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fill.qty >= 0 ? 'BUY' : 'SELL'} {Math.abs(fill.qty).toFixed(2)}</div>
              <div className="text-xs text-zinc-400">@ ${fill.px.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SystemHealthLightsPanel() {
  const bridgeStatus = useTelemetryStore((state) => state.bridgeStatus);
  const lastTickAt = useTelemetryStore((state) => state.lastTickAt);
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const fills = useTelemetryStore((state) => state.fills);
  const account = useTelemetryStore((state) => state.account);
  const [mlStatus, setMlStatus] = useState<'checking' | 'up' | 'down'>('checking');

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const check = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store', signal: controller.signal });
        if (!cancelled) setMlStatus(res.ok ? 'up' : 'down');
      } catch {
        if (!cancelled) setMlStatus('down');
      }
    };
    check();
    const interval = setInterval(check, 15000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  const services = useMemo(() => {
    const nowTs = Date.now();
    const lastTickAge = lastTickAt ? nowTs - lastTickAt : Number.POSITIVE_INFINITY;
    const lastGuardrail = guardrails[0]?.ts ?? null;
    const lastFill = fills[0]?.ts ?? null;
    const accountAge = account.ts ? nowTs - account.ts : Number.POSITIVE_INFINITY;

    const makeStatus = (healthy: boolean, degraded = false) => {
      if (healthy) return 'green' as const;
      return degraded ? ('amber' as const) : ('red' as const);
    };

    return [
      {
        name: 'Blotter',
        status: makeStatus(lastTickAge < 3_000, lastTickAge < 10_000),
        detail: lastTickAt ? formatDistanceToNow(lastTickAt) : 'No ticks',
      },
      {
        name: 'Algo',
        status: makeStatus(Boolean(lastFill && nowTs - lastFill < 60_000), Boolean(lastTickAt)),
        detail: lastFill ? formatDistanceToNow(lastFill) : 'No fills',
      },
      {
        name: 'Broker',
        status: makeStatus(accountAge < 10_000, accountAge < 30_000),
        detail: account.ts ? formatDistanceToNow(account.ts) : 'No acct',
      },
      {
        name: 'HMM Service',
        status: mlStatus === 'up' ? 'green' : mlStatus === 'checking' ? 'amber' : 'red',
        detail: mlStatus === 'up' ? 'Healthy' : mlStatus === 'checking' ? '...' : 'Offline',
      },
      {
        name: 'IBKR API',
        status: makeStatus(bridgeStatus === 'connected' && accountAge < 15_000, bridgeStatus === 'connected'),
        detail: bridgeStatus === 'connected' ? 'Conn' : 'Disc',
      },
      {
        name: 'Reports',
        status: makeStatus(Boolean(fills.length || guardrails.length), true),
        detail: fills.length ? `${fills.length}f` : 'Idle',
      },
      {
        name: 'Guardrails',
        status: guardrails.length ? 'amber' : 'green',
        detail: lastGuardrail ? formatDistanceToNow(lastGuardrail) : 'None',
      },
    ] as Array<{ name: string; status: 'green' | 'amber' | 'red'; detail: string }>;
  }, [account.ts, bridgeStatus, fills, guardrails, lastTickAt, mlStatus]);

  return (
    <Card title="System Health">
      <div className="flex flex-col h-full gap-1 py-1">
        {/* Service status in compact grid */}
        <div className="grid gap-1">
          {services.map((svc) => (
            <div key={svc.name} className="grid grid-cols-3 gap-2 items-center rounded-lg bg-[#10131d] px-2 py-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${svc.status === 'green' ? 'bg-emerald-400' : svc.status === 'amber' ? 'bg-amber-300' : 'bg-rose-400'}`} />
                <span className="text-white text-xs truncate">{svc.name}</span>
              </div>
              <div className="justify-self-end">
                <span className="text-emerald-400 font-medium text-xs">{svc.detail}</span>
              </div>
              <div className="justify-self-end">
                {svc.status === 'green' && <span className="text-emerald-400 text-xs">✓</span>}
                {svc.status === 'amber' && <span className="text-amber-400 text-xs">⚠</span>}
                {svc.status === 'red' && <span className="text-red-400 text-xs">✗</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function ControlPanel({ onCommand, controlStatus }: { onCommand: (request: ControlRequest, options?: { queue?: boolean }) => boolean; controlStatus: ControlChannelStatus }) {
  const bridgeStatus = useTelemetryStore((state) => state.bridgeStatus);
  const fills = useTelemetryStore((state) => state.fills);
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const account = useTelemetryStore((state) => state.account);
  const tradingEnabled = useStrategyStore((state) => state.settings.tradingEnabled);
  const setSettings = useStrategyStore((state) => state.setSettings);
  const [flattening, setFlattening] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFill = fills[0]?.ts ?? null;
  const lastGuardrail = guardrails[0]?.ts ?? null;

  const handleToggleTrading = async () => {
    const next = !tradingEnabled;
    setSettings({ tradingEnabled: next });
    onCommand({ kind: 'set_trading_mode', payload: { enabled: next } });
  };

  const handleFlattenAll = async () => {
    if (flattening) return;
    setFlattening(true);
    setError(null);
    try {
      const sent = onCommand({ kind: 'flatten_all' }, { queue: false });
      if (!sent) {
        const res = await fetch('/api/control/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'flatten_all', source: 'dashboard', ts: Date.now() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? 'flatten failed');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send flatten command');
    } finally {
      setFlattening(false);
    }
  };

  const handleRebuildUniverse = async () => {
    if (rebuilding) return;
    setRebuilding(true);
    setError(null);
    try {
      const sent = onCommand({ kind: 'rebuild_universe' }, { queue: false });
      if (!sent) {
        const res = await fetch('/api/control/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'rebuild_universe', source: 'dashboard', ts: Date.now() }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? 'rebuild failed');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send rebuild command');
    } finally {
      setRebuilding(false);
    }
  };

  const controlMeta = controlStatus === 'open'
    ? { label: 'Connected', tone: 'text-emerald-300' }
    : controlStatus === 'connecting'
      ? { label: 'Connecting…', tone: 'text-amber-300' }
      : controlStatus === 'error'
        ? { label: 'Error', tone: 'text-rose-300' }
        : { label: 'Reconnecting…', tone: 'text-amber-300' };

  return (
    <Card title="Operations">
      <div className="space-y-3 text-sm text-zinc-300">
        <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2">
          <span className="text-zinc-400">Data bridge</span>
          <span className={bridgeStatus === 'connected' ? 'text-emerald-300' : 'text-rose-300'}>
            {bridgeStatus === 'connected' ? 'Streaming' : 'Disconnected'}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2">
          <span className="text-zinc-400">Control link</span>
          <span className={controlMeta.tone}>{controlMeta.label}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2">
          <span className="text-zinc-400">Trading</span>
          <button
            onClick={handleToggleTrading}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${tradingEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}
          >
            {tradingEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2 text-xs text-zinc-400">
          Last fill: {lastFill ? formatDistanceToNow(lastFill, { addSuffix: true }) : 'no fills yet'}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2 text-xs text-zinc-400">
          Last guardrail: {lastGuardrail ? formatDistanceToNow(lastGuardrail, { addSuffix: true }) : 'none triggered'}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2 text-xs text-zinc-400">
          Buying power {formatUsd(account.buyingPower)} · Cash {formatUsd(account.cash)}
        </div>
        <button
          onClick={handleFlattenAll}
          disabled={flattening}
          className={`w-full rounded-lg border border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${flattening ? 'bg-zinc-900 text-zinc-500' : 'bg-rose-600/20 text-rose-200 hover:bg-rose-600/30'}`}
        >
          {flattening ? 'Sending Flatten…' : 'Flatten All Positions'}
        </button>
        <button
          onClick={handleRebuildUniverse}
          disabled={rebuilding}
          className={`w-full rounded-lg border border-zinc-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${rebuilding ? 'bg-zinc-900 text-zinc-500' : 'bg-amber-500/20 text-amber-200 hover:bg-amber-500/30'}`}
        >
          {rebuilding ? 'Rebuild Requested…' : 'Rebuild Universe'}
        </button>
        {error ? <div className="text-xs text-rose-300">{error}</div> : null}
      </div>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize] = useState(24); // Base font size

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-2 p-4 text-center min-w-0">
      <span
        className={`leading-tight font-bold truncate ${tone ?? 'text-white'}`}
        style={{ fontSize: Math.min(fontSize, 24), fontVariantNumeric: 'tabular-nums' }}
        title={value}
      >
        {value}
      </span>
      <span className="text-sm uppercase tracking-wider text-zinc-400 font-medium leading-tight truncate">
        {label}
      </span>
    </div>
  );
}

function SparklineChart({ data, height = 32, color = "#34d399" }: { data: Array<{ ts: string; value: number }>, height?: number, color?: string }) {
  if (!data.length) return <div className="flex items-center justify-center text-xs text-zinc-500">No data</div>;

  // Simple SVG-based sparkline
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((value, index) =>
    `${(index / (values.length - 1)) * 100},${100 - ((value - min) / range) * 100}`
  ).join(' ');

  return (
    <svg viewBox="0 0 100 100" className={`w-full h-${height/4}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  // Standardize 16px minimum padding across all cards, with space for resize handle
  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
