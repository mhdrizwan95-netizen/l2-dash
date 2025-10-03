"use client";

import { useMemo, useState, useEffect } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function TodayTop10Panel() {
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [nextRefresh, setNextRefresh] = useState(Date.now() + 300000); // 5 minutes

  // Mock top-10 data
  const topSymbols = useMemo(() => [
    { rank: 1, symbol: 'AAPL', dollarVol: 89_200_000, medianSpread: 2.1, tradeCount: 15420, isNew: false },
    { rank: 2, symbol: 'TSLA', dollarVol: 67_850_000, medianSpread: 3.2, tradeCount: 12850, isNew: false },
    { rank: 3, symbol: 'NVDA', dollarVol: 54_300_000, medianSpread: 2.8, tradeCount: 9870, isNew: true },
    { rank: 4, symbol: 'AMD', dollarVol: 41_700_000, medianSpread: 4.1, tradeCount: 8950, isNew: false },
    { rank: 5, symbol: 'MSFT', dollarVol: 38_900_000, medianSpread: 1.9, tradeCount: 12340, isNew: false },
    { rank: 6, symbol: 'GOOGL', dollarVol: 35_600_000, medianSpread: 2.7, tradeCount: 8970, isNew: false },
    { rank: 7, symbol: 'META', dollarVol: 29_400_000, medianSpread: 3.3, tradeCount: 7650, isNew: false },
    { rank: 8, symbol: 'PLTR', dollarVol: 24_800_000, medianSpread: 5.2, tradeCount: 4560, isNew: false },
    { rank: 9, symbol: 'NFLX', dollarVol: 19_100_000, medianSpread: 4.8, tradeCount: 3210, isNew: false },
    { rank: 10, symbol: 'SPOT', dollarVol: 17_500_000, medianSpread: 6.1, tradeCount: 2890, isNew: false },
  ], []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(Date.now());
      setNextRefresh(Date.now() + 300000);
    }, 300000); // Update every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const timeUntilRefresh = Math.max(0, Math.floor((nextRefresh - Date.now()) / 1000));
  const mins = Math.floor(timeUntilRefresh / 60);
  const secs = timeUntilRefresh % 60;

  return (
    <Card title="Today Top-10 (Dollar Volume)">
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-400">Next refresh in {mins}:{secs.toString().padStart(2, '0')}</span>
          <span className="text-zinc-400">Last: {new Date(lastRefresh).toLocaleTimeString()}</span>
        </div>

        <div className="space-y-1 max-h-64 overflow-y-auto">
          {topSymbols.map(symbol => (
            <div key={symbol.symbol} className="grid grid-cols-12 gap-2 text-xs py-1 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/20 rounded px-2">
              <div className="col-span-1 flex items-center justify-center">
                <span className={`font-bold ${symbol.rank <= 3 ? 'text-yellow-400' : symbol.isNew ? 'text-emerald-400' : 'text-zinc-300'}`}>
                  {symbol.rank}
                </span>
                {symbol.isNew && <span className="ml-1 text-emerald-400 text-[10px]">NEW</span>}
              </div>
              <div className="col-span-2 font-medium text-zinc-200">{symbol.symbol}</div>
              <div className="col-span-4 text-right text-zinc-300">{formatUsd(symbol.dollarVol)}</div>
              <div className="col-span-2 text-right text-zinc-300">{symbol.medianSpread.toFixed(1)}bps</div>
              <div className="col-span-3 text-right text-zinc-400">{symbol.tradeCount.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="text-xs text-zinc-500 space-y-1">
          <div>Updated every 5-15 minutes during market hours</div>
          <div>Volume since 9:30 ET • Based on consolidated tape</div>
        </div>
      </div>
    </Card>
  );
}

export function ActiveIntersectionPanel() {
  const [activeSymbols, setActiveSymbols] = useState<string[]>(['AAPL', 'TSLA', 'NVDA', 'AMD']);

  const intersection = useMemo(() => {
    const todayTop10 = ['AAPL', 'TSLA', 'NVDA', 'AMD', 'MSFT', 'GOOGL', 'META', 'PLTR', 'NFLX', 'SPOT'];
    const readyModels = ['AAPL', 'TSLA', 'NVDA', 'AMD', 'MSFT', 'GOOGL'];

    return todayTop10.map((symbol, index) => {
      const isActive = readyModels.includes(symbol);
      const isTraded = activeSymbols.includes(symbol);
      const status = isTraded ? 'Traded' : isActive ? 'Ready' : 'Shadow Only';

      return {
        rank: index + 1,
        symbol,
        status,
        dollarVol: Math.floor(Math.random() * 50_000_000) + 10_000_000,
        isNew: Math.random() > 0.8,
        isAdded: false,
        isRetired: false
      };
    }).slice(0, 10);
  }, [activeSymbols]);

  return (
    <Card title="Active Intersection">
      <div className="space-y-3">
        <div className="grid grid-cols-10 gap-1 text-[10px] font-medium text-zinc-400 mb-2">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-2">Symbol</div>
          <div className="col-span-4">Volume</div>
          <div className="col-span-3">Status</div>
        </div>

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {intersection.map(symbol => (
            <div key={symbol.symbol} className="grid grid-cols-10 gap-1 text-xs py-1 hover:bg-zinc-800/20 rounded px-1">
              <div className="col-span-1 flex items-center justify-center">
                <span className={`${symbol.isNew ? 'text-emerald-400' : symbol.rank <= 3 ? 'text-yellow-400' : 'text-zinc-300'}`}>
                  {symbol.rank}
                </span>
              </div>
              <div className="col-span-2 font-medium text-zinc-200">{symbol.symbol}</div>
              <div className="col-span-4 text-right text-zinc-300 pr-2">{formatUsd(symbol.dollarVol)}</div>
              <div className="col-span-3 text-[10px]">
                <span className={`px-1 py-0.5 rounded text-[10px] font-semibold ${
                  symbol.status === 'Traded' ? 'bg-emerald-500/20 text-emerald-300' :
                  symbol.status === 'Ready' ? 'bg-blue-500/20 text-blue-300' :
                  'bg-amber-500/20 text-amber-300'
                }`}>
                  {symbol.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-zinc-500 space-y-1">
          <div>Top-10 ∩ Ready Models (max 10 active symbols)</div>
          <div><span className="text-emerald-400">•</span> Traded • <span className="text-blue-400">•</span> Ready • <span className="text-amber-400">•</span> Shadow Only</div>
        </div>
      </div>
    </Card>
  );
}

export function WhyNotTradedPanel() {
  const excludedSymbols = useMemo(() => [
    { symbol: 'META', reason: 'NO_READY_MODEL', dollarVol: 29_400_000 },
    { symbol: 'PLTR', reason: 'NO_READY_MODEL', dollarVol: 24_800_000 },
    { symbol: 'NFLX', reason: 'CHURN_GUARD', dollarVol: 19_100_000 },
    { symbol: 'SPOT', reason: 'CHURN_GUARD', dollarVol: 17_500_000 },
  ], []);

  const reasonLabels = {
    'NO_READY_MODEL': 'No trained model ready',
    'CHURN_GUARD': 'Churn guard active',
    'OPEN_POSITION': 'Open position exists'
  };

  return (
    <Card title="Why Not Traded">
      <div className="space-y-2">
        {excludedSymbols.map(symbol => (
          <div key={symbol.symbol} className="flex items-center justify-between p-2 rounded bg-[#10131d] border border-zinc-800">
            <div className="flex items-center gap-3">
              <span className="font-medium text-zinc-200">{symbol.symbol}</span>
              <span className="text-xs text-zinc-400">{formatUsd(symbol.dollarVol)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-300">{reasonLabels[symbol.reason as keyof typeof reasonLabels]}</span>
              <button className="px-2 py-1 text-xs rounded border border-blue-600 text-blue-300 hover:bg-blue-600/10">
                View ML
              </button>
            </div>
          </div>
        ))}

        {excludedSymbols.length === 0 && (
          <div className="text-sm text-zinc-500 text-center py-4">
            No symbols excluded - all top-10 are tradeable
          </div>
        )}

        <div className="text-xs text-zinc-500 pt-2">
          <div>Reasons for exclusion from active universe</div>
        </div>
      </div>
    </Card>
  );
}

export function NextRefreshPanel() {
  const [nextRefresh, setNextRefresh] = useState(() => {
    const now = new Date();
    const next5Min = new Date(now);
    next5Min.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
    return next5Min.getTime();
  });

  const [churnGuardUntil, setChurnGuardUntil] = useState(() => {
    const now = new Date();
    const endOfHour = new Date(now);
    endOfHour.setHours(now.getHours() + 1, 0, 0, 0);
    return endOfHour.getTime();
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();

      // Update next refresh time
      const next5Min = new Date(now);
      next5Min.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
      setNextRefresh(next5Min.getTime());

      // Update churn guard (simulated)
      if (churnGuardUntil < now.getTime()) {
        const endOfHour = new Date(now);
        endOfHour.setHours(now.getHours() + 1, 0, 0, 0);
        setChurnGuardUntil(endOfHour.getTime());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [churnGuardUntil]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsRefreshing(false);
  };

  const timeUntilRefresh = Math.max(0, Math.floor((nextRefresh - Date.now()) / 1000));
  const churnTimeLeft = Math.max(0, Math.floor((churnGuardUntil - Date.now()) / 1000));

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card title="Next Refresh & Churn Guard">
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-zinc-300">Next Universe Refresh</span>
            <span className="text-lg font-semibold text-emerald-300">{formatTime(timeUntilRefresh)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-zinc-300">Churn Guard Active</span>
            <span className={`text-lg font-semibold ${churnTimeLeft > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
              {churnTimeLeft > 0 ? formatTime(churnTimeLeft) : '00:00'}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="w-full px-3 py-2 text-sm font-semibold uppercase tracking-wide text-zinc-200 border border-blue-400/40 bg-blue-500/10 rounded hover:bg-blue-500/20 disabled:opacity-50"
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh Now'}
          </button>
        </div>

        <div className="text-xs text-zinc-500 space-y-1">
          <div>Churn guard prevents symbol swapping mid-hour</div>
          <div>Last successful refresh: {new Date(Date.now() - 300000).toLocaleTimeString()}</div>
        </div>
      </div>
    </Card>
  );
}

export function YearTop10Panel() {
  const [yearTopSymbols] = useState(() => [
    { rank: 1, symbol: 'AAPL', addv: 894_500_000_000, medianSpread: 2.1 },
    { rank: 2, symbol: 'TSLA', addv: 789_200_000_000, medianSpread: 3.2 },
    { rank: 3, symbol: 'NVDA', addv: 678_900_000_000, medianSpread: 2.8 },
    { rank: 4, symbol: 'MSFT', addv: 567_300_000_000, medianSpread: 1.9 },
    { rank: 5, symbol: 'GOOGL', addv: 445_600_000_000, medianSpread: 2.7 },
    { rank: 6, symbol: 'AMZN', addv: 345_200_000_000, medianSpread: 2.4 },
    { rank: 7, symbol: 'META', addv: 298_700_000_000, medianSpread: 3.3 },
    { rank: 8, symbol: 'TSM', addv: 234_100_000_000, medianSpread: 3.8 },
    { rank: 9, symbol: 'BABA', addv: 198_400_000_000, medianSpread: 4.2 },
    { rank: 10, symbol: 'NFLX', addv: 167_800_000_000, medianSpread: 4.8 },
  ]);

  const [lastRebuild, setLastRebuild] = useState(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    yesterday.setHours(1, 30, 0, 0); // 01:30 ET
    return yesterday.getTime();
  });

  return (
    <Card title="Year Top-10 (ADDV)">
      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-400">Last rebuild</span>
          <span className="text-zinc-400">{new Date(lastRebuild).toLocaleString()}</span>
        </div>

        <div className="space-y-1 max-h-64 overflow-y-auto">
          {yearTopSymbols.map(symbol => (
            <div key={symbol.symbol} className="grid grid-cols-12 gap-2 text-xs py-1 border-b border-zinc-800 last:border-b-0 hover:bg-zinc-800/20 rounded px-2">
              <div className="col-span-1 flex items-center justify-center">
                <span className={`font-bold ${symbol.rank <= 3 ? 'text-yellow-400' : 'text-zinc-300'}`}>
                  {symbol.rank}
                </span>
              </div>
              <div className="col-span-3 font-medium text-zinc-200">{symbol.symbol}</div>
              <div className="col-span-5 text-right text-zinc-300">{formatUsd(symbol.addv)}</div>
              <div className="col-span-3 text-right text-zinc-400">{symbol.medianSpread.toFixed(1)}bps</div>
            </div>
          ))}
        </div>

        <div className="text-xs text-zinc-500 space-y-1">
          <div>Average Daily Dollar Volume (252 trading days)</div>
          <div>Rebuilt nightly at 01:30 ET</div>
        </div>
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
