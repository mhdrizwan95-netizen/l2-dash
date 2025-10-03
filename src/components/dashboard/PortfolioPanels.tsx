'use client';

import { useMemo } from 'react';
import { ResponsiveContainer, Area, AreaChart, Tooltip, XAxis, YAxis } from 'recharts';
import { useTelemetryStore } from '@/lib/telemetryStore';
import { formatDistanceToNow, startOfDay } from 'date-fns';

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(2)}%`;
}

export function PositionsTablePanel() {
  const positions = useTelemetryStore((state) => state.positions);
  const ticks = useTelemetryStore((state) => state.ticks);
  const fills = useTelemetryStore((state) => state.fills);

  const rows = useMemo(() => {
    const entries = Object.values(positions);
    if (!entries.length) return [];
    const gross = entries.reduce((acc, pos) => {
      const last = ticks[pos.symbol]?.price ?? pos.avgPx;
      return acc + Math.abs(last * pos.qty);
    }, 0);

    const lastFillsBySymbol = new Map();
    fills.forEach((fill) => {
      if (!lastFillsBySymbol.has(fill.symbol) || fill.ts > lastFillsBySymbol.get(fill.symbol).ts) {
        lastFillsBySymbol.set(fill.symbol, fill);
      }
    });

    return entries
      .map((pos) => {
        const last = ticks[pos.symbol]?.price ?? pos.avgPx;
        const unrealized = (last - pos.avgPx) * pos.qty;
        const notional = Math.abs(last * pos.qty);
        const share = gross > 0 ? (notional / gross) * 100 : 0;
        const uplPct = pos.avgPx ? (unrealized / (pos.avgPx * pos.qty)) * 100 : 0;
        const lastFill = lastFillsBySymbol.get(pos.symbol);
        return {
          symbol: pos.symbol,
          qty: pos.qty,
          avgPx: pos.avgPx,
          marketPx: last,
          unrealized,
          uplPct,
          share,
          lastFillTs: lastFill ? lastFill.ts : null,
        };
      })
      .sort((a, b) => Math.abs(b.unrealized) - Math.abs(a.unrealized));
  }, [positions, ticks, fills]);

  return (
    <Card title="Positions">
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          No open positions. Live fills will appear here as orders execute.
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-zinc-500">
              <tr>
                {['Symbol', 'Qty', 'Avg Px', 'Mkt Px', 'UPL $', 'UPL %', '% of portfolio', 'Last fill ts'].map((label) => (
                  <th key={label} className="px-4 py-2 text-left font-medium uppercase tracking-wide text-xs">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-200">
              {rows.map((row) => (
                <tr key={row.symbol}>
                  <td className="px-4 py-2 font-medium text-white">{row.symbol}</td>
                  <td className="px-4 py-2">{row.qty.toFixed(2)}</td>
                  <td className="px-4 py-2">{formatUsd(row.avgPx)}</td>
                  <td className="px-4 py-2">{formatUsd(row.marketPx)}</td>
                  <td className={`px-4 py-2 ${row.unrealized >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatUsd(row.unrealized)}</td>
                  <td className={`px-4 py-2 ${row.uplPct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatPct(row.uplPct)}</td>
                  <td className="px-4 py-2">{formatPct(row.share)}</td>
                  <td className="px-4 py-2">{row.lastFillTs ? new Date(row.lastFillTs).toLocaleTimeString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function ExposureMetricsPanel() {
  const positions = useTelemetryStore((state) => state.positions);
  const ticks = useTelemetryStore((state) => state.ticks);
  const account = useTelemetryStore((state) => state.account);

  const metrics = useMemo(() => {
    const entries = Object.values(positions);
    if (!entries.length) return [];
    let longExposure = 0;
    let shortExposure = 0;
    let gross = 0;
    entries.forEach((pos) => {
      const last = ticks[pos.symbol]?.price ?? pos.avgPx;
      const notional = last * pos.qty;
      gross += Math.abs(notional);
      if (notional >= 0) longExposure += notional;
      else shortExposure += notional;
    });
    const net = longExposure + shortExposure;
    const marginPct = account.buyingPower > 0 ? (account.marginUsed / account.buyingPower) * 100 : 0;
    const leverage = account.netLiquidation > 0 ? gross / account.netLiquidation : 0;
    const varEstimate = gross > 0 ? (gross * 0.02) : 0; // simple placeholder 2% VaR
    return [
      { label: 'Net Exposure', value: formatUsd(net) },
      { label: 'Gross Exposure', value: formatUsd(gross) },
      { label: 'Long Exposure', value: formatUsd(longExposure) },
      { label: 'Short Exposure', value: formatUsd(shortExposure) },
      { label: 'Margin Used', value: `${formatPct(marginPct)}` },
      { label: 'Leverage', value: leverage.toFixed(2) + '×' },
      { label: 'VaR (95%)', value: formatUsd(-Math.abs(varEstimate)) },
    ];
  }, [account.buyingPower, account.marginUsed, account.netLiquidation, positions, ticks]);

  return (
    <Card title="Exposure Metrics">
      {metrics.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Exposure metrics become available once positions are established.
        </div>
      ) : (
        <div className="grid gap-3 text-sm">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2">
              <span className="text-zinc-400">{metric.label}</span>
              <span className="text-white">{metric.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function PnlTimelinePanel() {
  const positions = useTelemetryStore((state) => state.positions);
  const ticks = useTelemetryStore((state) => state.ticks);

  const timeline = useMemo(() => {
    const active = Object.values(positions).filter((pos) => pos.qty !== 0);
    if (!active.length) return [];
    const aggregates = new Map<number, number>();
    active.forEach((pos) => {
      const history = ticks[pos.symbol]?.history ?? [];
      history.forEach(({ ts, price }) => {
        const current = aggregates.get(ts) ?? 0;
        aggregates.set(ts, current + pos.qty * price);
      });
    });
    return Array.from(aggregates.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(-180)
      .map(([ts, value]) => ({ ts: new Date(ts).toLocaleTimeString(), value }));
  }, [positions, ticks]);

  return (
    <Card title="Portfolio Notional">
      {timeline.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Notional history will populate once live positions stream through the blotter.
        </div>
      ) : (
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="pnlTimeline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="ts" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f121d', borderRadius: 8 }} formatter={(value: number) => formatUsd(value)} />
              <Area type="monotone" dataKey="value" stroke="#38bdf8" fill="url(#pnlTimeline)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function RiskMetricsPanel() {
  const fills = useTelemetryStore((state) => state.fills);
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const account = useTelemetryStore((state) => state.account);

  const metrics = useMemo(() => {
    if (!fills.length && !guardrails.length) return [];
    const paperFills = fills.filter((fill) => fill.kind !== 'shadow');
    const shadowFills = fills.filter((fill) => fill.kind === 'shadow');
    const avgFillSize = paperFills.length
      ? paperFills.reduce((acc, fill) => acc + Math.abs(fill.qty), 0) / paperFills.length
      : 0;
    const blockCount = guardrails.filter((g) => g.severity === 'block').length;
    const lastGuard = guardrails[0]?.ts ?? null;

    // Turnover calculation
    const todayStart = startOfDay(new Date()).getTime();
    const todayPaperFills = paperFills.filter(f => f.ts >= todayStart);
    const turnover = todayPaperFills.reduce((acc, f) => acc + Math.abs(f.qty) * f.px, 0);

    // Avg holding time (simple approximation)
    const holdingTimes: number[] = [];
    const symbolTrades = new Map();
    paperFills.forEach(fill => {
      if (!symbolTrades.has(fill.symbol)) symbolTrades.set(fill.symbol, []);
      symbolTrades.get(fill.symbol).push(fill);
    });
    symbolTrades.forEach((trades: typeof fills[0][]) => {
      trades.sort((a, b) => a.ts - b.ts);
      for (let i = 1; i < trades.length; i++) {
        if (trades[i].qty * trades[i-1].qty < 0) { // opposite signs
          holdingTimes.push(trades[i].ts - trades[i-1].ts);
        }
      }
    });
    const avgHoldingTime = holdingTimes.length ? holdingTimes.reduce<number>((a, b) => a + b, 0) / holdingTimes.length / 1000 / 60 : 0; // minutes

    // Flips/day
    const flips = Math.floor(holdingTimes.length / 2); // rough

    return [
      { label: 'Turnover (day)', value: formatUsd(turnover) },
      { label: '# trades', value: `${paperFills.length}` },
      { label: 'Avg trade size', value: `${avgFillSize.toFixed(2)}` },
      { label: 'Avg holding time', value: avgHoldingTime > 0 ? `${avgHoldingTime.toFixed(1)} min` : '—' },
      { label: 'Flips/day', value: `${flips}` },
      { label: 'Guardrail blocks', value: `${blockCount}` },
      { label: 'Last guardrail', value: lastGuard ? new Date(lastGuard).toLocaleTimeString() : '—' },
    ];
  }, [fills, guardrails]);

  return (
    <Card title="Execution Stats">
      {metrics.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Execution metrics will populate once orders route through the broker.
        </div>
      ) : (
        <div className="grid gap-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2 text-sm">
              <span className="text-zinc-400">{metric.label}</span>
              <span className="text-white font-medium">{metric.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function CashBuyingPowerPanel() {
  const account = useTelemetryStore((state) => state.account);
  const snapshotAvailable = Boolean(account.ts);
  const marginPct = account.buyingPower > 0 ? (account.marginUsed / account.buyingPower) * 100 : 0;

  return (
    <Card title="Cash & Buying Power">
      {!snapshotAvailable ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Awaiting account summary from IBKR. Ensure the bridge is connected and the ingest key matches.
        </div>
      ) : (
        <div className="grid gap-3 text-sm">
          <MetricRow label="Available Cash" value={formatUsd(account.cash)} />
          <MetricRow label="Available Funds" value={formatUsd(account.availableFunds)} />
          <MetricRow label="Buying Power" value={formatUsd(account.buyingPower)} />
          <MetricRow label="Margin Used" value={`${formatUsd(account.marginUsed)} (${formatPct(marginPct)})`} />
          <MetricRow label="Net Liquidation" value={formatUsd(account.netLiquidation)} />
          <MetricRow label="Equity w/ Loan" value={formatUsd(account.equityWithLoan)} />
          <div className="rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2 text-xs text-zinc-400">
            Last update {account.ts ? formatDistanceToNow(account.ts, { addSuffix: true }) : '—'}
          </div>
        </div>
      )}
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

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2">
      <span className="text-zinc-400">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}
