'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTelemetryStore, type TickHistoryPoint } from '@/lib/telemetryStore';
import { useStrategyStore } from '@/lib/strategyStore';
import { useStrategies } from '@/hooks/useStrategies';
import { useDashboardStore } from '@/lib/dashboardStore';
import { XCircle } from 'lucide-react';

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  const prefix = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${prefix}$${(abs / 1_000).toFixed(1)}K`;
  return `${prefix}$${abs.toFixed(2)}`;
}

function calcPctChange(history: TickHistoryPoint[]): number {
  if (!history.length) return 0;
  const first = history[0].price;
  const last = history[history.length - 1].price;
  if (!first) return 0;
  return ((last - first) / first) * 100;
}

type SymbolCardData = {
  symbol: string;
  price: number | null;
  history: TickHistoryPoint[];
  pct: number;
  exposure: number;
  realized: number;
  tradeCount: number;
  guardrailCount: number;
  strategy: string;
  hasData: boolean;
};

export function SymbolOverviewGrid() {
  const ticks = useTelemetryStore((state) => state.ticks);
  const positions = useTelemetryStore((state) => state.positions);
  const fills = useTelemetryStore((state) => state.fills);
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const slots = useStrategyStore((state) => state.slots);
  const { strategies } = useStrategies();

  const watchlist = useDashboardStore((state) => state.selectedSymbols);
  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const setSelectedSymbol = useDashboardStore((state) => state.setSelectedSymbol);
  const addSymbol = useDashboardStore((state) => state.addSymbol);
  const removeSymbol = useDashboardStore((state) => state.removeSymbol);

  const [draftSymbol, setDraftSymbol] = useState('');
  const layoutMode = useStrategyStore((state) => (state.settings.tradingEnabled ? 'live' : 'paper'));

  const strategyNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const strat of strategies) {
      if (strat.id) map[strat.id] = strat.name ?? strat.id;
    }
    return map;
  }, [strategies]);

  const cards: SymbolCardData[] = useMemo(() => {
    return watchlist.map((symbol) => {
      const entry = ticks[symbol];
      const hist = entry?.history ? entry.history.slice(-120) : [];
      const pct = calcPctChange(hist);
      const position = positions[symbol];
      const price = entry?.price ?? null;
      const exposure = position && price !== null ? position.qty * price : 0;
      const realized = position?.realizedPnL ?? 0;
      const tradeCount = fills.filter((f) => f.symbol === symbol).length;
      const guardrailCount = guardrails.filter((g) => g.symbol === symbol || !g.symbol).length;
      const slot = slots.find((s) => s.symbols.includes(symbol));
      const strategyName = slot?.strategyId ? strategyNameById[slot.strategyId] ?? slot.strategyId : 'Unassigned';
      return {
        symbol,
        price,
        history: hist,
        pct,
        exposure,
        realized,
        tradeCount,
        guardrailCount,
        strategy: strategyName,
        hasData: Boolean(entry),
      };
    });
  }, [fills, guardrails, positions, slots, strategyNameById, ticks, watchlist]);

  const availableSymbols = useMemo(() => {
    const streaming = Object.keys(ticks).filter((symbol) => symbol !== 'MOCK');
    return streaming.filter((symbol) => !watchlist.includes(symbol));
  }, [ticks, watchlist]);

  useEffect(() => {
    if (!watchlist.length) {
      setSelectedSymbol(null);
      return;
    }
    if (!selectedSymbol || !watchlist.includes(selectedSymbol)) {
      setSelectedSymbol(watchlist[0]);
    }
  }, [selectedSymbol, setSelectedSymbol, watchlist]);

  const handleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = draftSymbol.trim().toUpperCase();
    if (!normalized) return;
    addSymbol(normalized);
    setDraftSymbol('');
  };

  return (
    <div className="flex flex-col h-full rounded-xl border border-zinc-800 bg-[#0d101a] p-4 overflow-hidden">
      <div className="flex-shrink-0 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Symbol Watchlist</div>
          <div className="text-sm text-zinc-400">Add any symbol to monitor it; click a card to focus.</div>
        </div>
        <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
          <input
            value={draftSymbol}
            onChange={(event) => setDraftSymbol(event.target.value.toUpperCase())}
            placeholder="Add symbol (e.g. ETH)"
            className="w-32 rounded-lg border border-zinc-700 bg-[#0d101a] px-3 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
            aria-label="Add symbol to watchlist"
          />
          <button
            type="submit"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            disabled={!draftSymbol.trim()}
          >
            Add
          </button>
        </form>
      </div>

      {availableSymbols.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span className="uppercase tracking-wider">Live feed:</span>
          {availableSymbols.map((symbol) => (
            <button
              key={symbol}
              type="button"
              onClick={() => addSymbol(symbol)}
              className="rounded-full border border-zinc-700 bg-[#0d101a] px-3 py-1 font-semibold uppercase tracking-wider text-zinc-300 transition-colors hover:border-emerald-500 hover:text-white"
            >
              + {symbol}
            </button>
          ))}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-800 bg-[#10131d] p-6 text-center text-sm text-zinc-400">
          No symbols tracked yet. Add one above to get started.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          {cards.map((card) => (
            <SymbolCard
              key={card.symbol}
              data={card}
              isActive={card.symbol === selectedSymbol}
              onSelect={setSelectedSymbol}
              onRemove={removeSymbol}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SymbolCard({
  data,
  isActive,
  onSelect,
  onRemove,
}: {
  data: SymbolCardData;
  isActive: boolean;
  onSelect: (symbol: string) => void;
  onRemove: (symbol: string) => void;
}) {
  const chartData = useMemo(() => {
    return data.history.map((point) => ({
      ts: new Date(point.ts).toLocaleTimeString(),
      price: point.price,
    }));
  }, [data.history]);

  const pctLabel = data.hasData ? `${data.pct >= 0 ? '+' : ''}${data.pct.toFixed(2)}%` : 'Awaiting ticks';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(data.symbol)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(data.symbol);
        }
      }}
      className={`group rounded-xl border p-4 space-y-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:ring-offset-2 focus:ring-offset-[#050507] ${
        isActive ? 'border-emerald-500/60 bg-[#101822]' : 'border-[#1a1d28] bg-[#0d101a] hover:border-emerald-500/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">{data.strategy}</div>
          <div className="text-lg font-semibold text-white">{data.symbol}</div>
        </div>
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(data.symbol);
            }}
            className="rounded-full bg-[#151923] p-1.5 text-zinc-400 transition-colors hover:text-rose-400"
            aria-label={`Remove ${data.symbol} from watchlist`}
          >
            <XCircle className="h-4 w-4" />
          </button>
          <div className="text-right">
            <div className="text-sm font-semibold text-white">{data.hasData && data.price !== null ? `$${data.price.toFixed(2)}` : '—'}</div>
            <div className={`text-xs ${data.pct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{pctLabel}</div>
          </div>
        </div>
      </div>

      {chartData.length > 1 ? (
        <div className="h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${data.symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="ts" hide />
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip contentStyle={{ background: '#090b11', border: '1px solid #272936', borderRadius: 8 }} />
              <Area type="monotone" dataKey="price" stroke="#34d399" fill={`url(#spark-${data.symbol})`} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-xs text-zinc-500">
          Waiting for historical ticks…
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <InfoLine label="Exposure" value={formatUsd(data.exposure)} tone={data.exposure >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
        <InfoLine label="Realized" value={formatUsd(data.realized)} tone={data.realized >= 0 ? 'text-emerald-300' : 'text-rose-300'} />
        <InfoLine label="Trades" value={String(data.tradeCount)} />
        <InfoLine label="Alerts" value={String(data.guardrailCount)} tone={data.guardrailCount > 0 ? 'text-amber-300' : 'text-zinc-400'} />
      </div>
    </div>
  );
}

function InfoLine({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className={`text-sm font-semibold ${tone ?? 'text-white'}`}>{value}</span>
    </div>
  );
}
