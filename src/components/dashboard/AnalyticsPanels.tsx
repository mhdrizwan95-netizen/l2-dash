"use client";

import { useMemo, useState } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

export function AnalyticsGridContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[calc(100vh-200px)] overflow-hidden">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full overflow-y-auto p-4">
        {children}
      </div>
    </div>
  );
}

export function PnLDistributionPanel() {
  // Mock PnL distribution data
  const pnlDistribution = useMemo(() => {
    const trades = Array.from({ length: 100 }, () => ({
      pnl: (Math.random() - 0.5) * 1000,
      timestamp: Date.now() - Math.random() * 86400000
    }));

    const bins = [0, 0, 0, 0, 0]; // <-$100, -$100-$0, $0-$100, $100-$500, >$500
    trades.forEach(trade => {
      if (trade.pnl < -100) bins[0]++;
      else if (trade.pnl < 0) bins[1]++;
      else if (trade.pnl < 100) bins[2]++;
      else if (trade.pnl < 500) bins[3]++;
      else bins[4]++;
    });

    return {
      totalTrades: trades.length,
      bins,
      binLabels: ['< -$100', '-$100 to $0', '$0 to $100', '$100 to $500', '> $500'],
      mean: trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length,
      std: Math.sqrt(trades.reduce((sum, t) => sum + Math.pow(t.pnl, 2), 0) / trades.length - Math.pow(trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length, 2))
    };
  }, []);

  const selectedFilter = 'all'; // Would be controlled by filters

  return (
    <Card title="PnL Distribution">
      <div className="space-y-4">
        <div className="flex justify-between items-center text-xs">
          <select
            value={selectedFilter}
            onChange={() => {}}
            className="px-2 py-1 text-xs text-zinc-200 bg-[#10131d] border border-zinc-700 rounded focus:outline-none"
          >
            <option value="all">All Trades</option>
            <option value="symbol">By Symbol</option>
            <option value="strategy">By Strategy</option>
          </select>
          <span className="text-zinc-400">Mean: {formatUsd(pnlDistribution.mean)} • Std: {formatUsd(pnlDistribution.std)}</span>
        </div>

        <div className="space-y-1">
          <div className="grid grid-cols-3 gap-1 text-[10px] font-medium text-zinc-400 mb-1">
            <div>Range</div>
            <div>Count</div>
            <div>%</div>
          </div>
          {pnlDistribution.bins.map((count, i) => (
            <div key={i} className="grid grid-cols-3 gap-1 text-xs">
              <div className="text-zinc-300">{pnlDistribution.binLabels[i]}</div>
              <div className="text-zinc-300">{count}</div>
              <div className="flex items-center gap-1">
                <div className="flex-1 bg-zinc-800 rounded-sm">
                  <div
                    className="bg-cyan-600 h-1 rounded-sm transition-all duration-300"
                    style={{ width: `${(count / pnlDistribution.totalTrades) * 100}%` }}
                  />
                </div>
                <span className="text-zinc-400 text-[10px] w-6">{((count / pnlDistribution.totalTrades) * 100).toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-zinc-500">
          Distribution based on {pnlDistribution.totalTrades} recent trades
        </div>
      </div>
    </Card>
  );
}

export function TradeOutcomeHistogramPanel() {
  const histogramData = useMemo(() => {
    const wins = Array.from({ length: 30 }, () => Math.abs(Math.random() * 200) + 20);
    const losses = Array.from({ length: 20 }, () => Math.abs(Math.random() * 150) + 10);

    return {
      wins,
      losses,
      winRate: (wins.length / (wins.length + losses.length)) * 100,
      avgWin: wins.reduce((a, b) => a + b, 0) / wins.length,
      avgLoss: losses.reduce((a, b) => a + b, 0) / losses.length,
      medianWin: wins.sort((a, b) => a - b)[Math.floor(wins.length / 2)],
      medianLoss: losses.sort((a, b) => a - b)[Math.floor(losses.length / 2)]
    };
  }, []);

  return (
    <Card title="Trade Outcome Histogram">
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <div className="text-2xl font-semibold text-emerald-300">{histogramData.winRate.toFixed(1)}%</div>
          <div className="text-xs text-zinc-400">Win Rate</div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="text-center">
            <div className="text-sm font-semibold text-emerald-300">{formatUsd(histogramData.avgWin)}</div>
            <div className="text-zinc-400">Avg Win</div>
            <div className="text-zinc-500">{formatUsd(histogramData.medianWin)} median</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-rose-300">-{formatUsd(histogramData.avgLoss)}</div>
            <div className="text-zinc-400">Avg Loss</div>
            <div className="text-zinc-500">-{formatUsd(histogramData.medianLoss)} median</div>
          </div>
        </div>

        {/* Enhanced histogram visualization */}
        <div className="space-y-2">
          <div className="text-xs text-zinc-400 mb-2">Win/Loss Distribution</div>
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'Wins', count: histogramData.wins.length, color: '#10b981' },
                { name: 'Losses', count: histogramData.losses.length, color: '#ef4444' }
              ]}>
                <Bar dataKey="count" fill="#10b981" />
                <YAxis type="number" hide />
                <XAxis type="category" dataKey="name" hide />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 text-[10px] text-zinc-400">
            <span>Wins ({histogramData.wins.length})</span>
            <span>Losses ({histogramData.losses.length})</span>
          </div>
        </div>

        {/* Skew/fat tails analysis would go here */}
        <div className="text-xs text-zinc-500">
          {histogramData.avgWin > histogramData.avgLoss * 1.5 ? 'Favorable risk-reward ratio detected' : 'Consider improving win/loss sizing'}
        </div>
      </div>
    </Card>
  );
}

export function StateReturnsHeatmapPanel() {
  // Mock HMM state returns data
  const stateReturns = useMemo(() => {
    const states = ['Bull Trend', 'Bear Trend', 'Sideways', 'High Vol', 'Low Vol'];
    const returns = Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, () => (Math.random() - 0.5) * 4));

    return { states, returns };
  }, []);

  const [viewMode, setViewMode] = useState('absolute'); // absolute | relative

  const getColor = (value: number) => {
    const abs = Math.abs(value);
    if (value > 0) {
      if (abs > 2) return 'bg-emerald-600 text-white';
      if (abs > 1) return 'bg-emerald-500 text-white';
      return 'bg-emerald-400 text-white';
    } else {
      if (abs > 2) return 'bg-rose-600 text-white';
      if (abs > 1) return 'bg-rose-500 text-white';
      return 'bg-rose-400 text-white';
    }
  };

  return (
    <Card title="State vs Returns Heatmap">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-xs text-zinc-500">Expected returns (bps) by HMM state</div>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="px-2 py-1 text-xs text-zinc-200 bg-[#10131d] border border-zinc-700 rounded focus:outline-none"
          >
            <option value="absolute">Absolute</option>
            <option value="relative">Relative to Market</option>
          </select>
        </div>

        <div className="space-y-2">
          {stateReturns.states.map((state, i) => (
            <div key={state} className="grid grid-cols-6 gap-1 items-center">
              <div className="text-xs font-medium text-zinc-300 pr-2">{state}</div>
              {stateReturns.returns[i].map((ret, j) => (
                <div
                  key={j}
                  className={`text-center py-1 rounded text-xs font-semibold ${getColor(ret)}`}
                  title={`${state} → ${stateReturns.states[j]}: ${(ret > 0 ? '+' : '') + ret.toFixed(2)} bps`}
                >
                  {ret > 0 ? '+' : ''}{ret.toFixed(1)}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="flex justify-between text-xs text-zinc-500">
          <span>Market Regime Transitions</span>
          <span>Expected alpha in basis points</span>
        </div>
      </div>
    </Card>
  );
}

export function SharpeTrendsPanel() {
  const trendsData = useMemo(() => {
    const periods = ['1D', '1W', '1M', '3M', '6M'];
    const sharpe = [1.2, 1.8, 2.1, 1.9, 2.3];
    const hitRate = [52, 55, 58, 56, 61];

    // Generate sparkline data
    const sharpeSparkline = periods.map((period, i) => ({
      period,
      value: sharpe[i],
      index: i
    }));
    const hitRateSparkline = periods.map((period, i) => ({
      period,
      value: hitRate[i],
      index: i
    }));

    return { periods, sharpe, hitRate, sharpeSparkline, hitRateSparkline };
  }, []);

  return (
    <Card title="Sharpe / Hit-rate Trends">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-zinc-300 mb-2">Rolling Sharpe Ratio</div>
            {/* Sparkline */}
            <div className="h-12 mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsData.sharpeSparkline}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', strokeWidth: 0, r: 2 }}
                    activeDot={{ r: 3, stroke: '#10b981', strokeWidth: 1 }}
                  />
                  <YAxis hide domain={['dataMin - 0.2', 'dataMax + 0.2']} />
                  <XAxis hide />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1">
              {trendsData.periods.map((period, i) => (
                <div key={period} className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">{period}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-zinc-800 rounded-sm">
                      <div
                        className={`h-1 rounded-sm ${
                          trendsData.sharpe[i] >= 2 ? 'bg-emerald-500' :
                          trendsData.sharpe[i] >= 1.5 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, (trendsData.sharpe[i] / 3) * 100)}%` }}
                      />
                    </div>
                    <span className={`font-semibold ${
                      trendsData.sharpe[i] >= 2 ? 'text-emerald-300' :
                      trendsData.sharpe[i] >= 1.5 ? 'text-amber-300' : 'text-rose-300'
                    }`}>
                      {trendsData.sharpe[i].toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-zinc-300 mb-2">Hit Rate %</div>
            {/* Hit rate sparkline */}
            <div className="h-12 mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsData.hitRateSparkline}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ fill: '#06b6d4', strokeWidth: 0, r: 2 }}
                    activeDot={{ r: 3, stroke: '#06b6d4', strokeWidth: 1 }}
                  />
                  <YAxis hide domain={[45, 65]} />
                  <XAxis hide />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1">
              {trendsData.periods.map((period, i) => (
                <div key={period} className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">{period}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-zinc-800 rounded-sm">
                      <div
                        className="bg-cyan-500 h-1 rounded-sm"
                        style={{ width: `${trendsData.hitRate[i]}%` }}
                      />
                    </div>
                    <span className="font-semibold text-cyan-300">
                      {trendsData.hitRate[i]}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-xs text-zinc-500">
          Rolling performance metrics • Sparklines show trends over time
        </div>
      </div>
    </Card>
  );
}

export function StrategyComparisonsPanel() {
  const comparisonData = useMemo(() => [
    {
      strategy: 'Live HMM',
      pnl: 125430,
      sharpe: 2.1,
      maxDrawdown: -5430,
      turnover: 2.3
    },
    {
      strategy: 'Shadow HMM',
      pnl: 118750,
      sharpe: 1.9,
      maxDrawdown: -6210,
      turnover: 2.8
    },
    {
      strategy: 'Mean Reversion',
      pnl: 89200,
      sharpe: 1.4,
      maxDrawdown: -12800,
      turnover: 4.2
    },
    {
      strategy: 'Momentum',
      pnl: 156000,
      sharpe: 1.8,
      maxDrawdown: -15600,
      turnover: 3.1
    }
  ], []);

  const [sortBy, setSortBy] = useState('pnl');

  const sortedData = [...comparisonData].sort((a, b) => {
    switch (sortBy) {
      case 'pnl': return b.pnl - a.pnl;
      case 'sharpe': return b.sharpe - a.sharpe;
      case 'dd': return a.maxDrawdown - b.maxDrawdown;
      case 'turnover': return b.turnover - a.turnover;
      default: return 0;
    }
  });

  return (
    <Card title="Strategy Comparisons">
      <div className="space-y-4">
        <div className="flex justify-center gap-1">
          {['pnl', 'sharpe', 'dd', 'turnover'].map(metric => (
            <button
              key={metric}
              onClick={() => setSortBy(metric)}
              className={`px-2 py-1 text-xs rounded ${
                sortBy === metric
                  ? 'bg-cyan-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              {metric === 'pnl' ? 'PnL' : metric === 'sharpe' ? 'Sharpe' : metric === 'dd' ? 'MaxDD' : 'Turnover'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2 text-xs font-medium text-zinc-400 mb-2">
          <div className="col-span-2">Strategy</div>
          <div className="text-right">PnL</div>
          <div className="text-right">Sharpe</div>
          <div className="text-right">Turnover</div>
        </div>

        <div className="space-y-1">
          {sortedData.map(strategy => (
            <div key={strategy.strategy} className="grid grid-cols-5 gap-2 text-xs bg-[#10131d] p-2 rounded">
              <div className="col-span-2 font-medium text-zinc-200">{strategy.strategy}</div>
              <div className={`text-right font-semibold ${strategy.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {strategy.pnl >= 0 ? '+' : ''}{formatUsd(strategy.pnl)}
              </div>
              <div className={`text-right font-semibold ${
                strategy.sharpe >= 2 ? 'text-emerald-300' :
                strategy.sharpe >= 1.5 ? 'text-amber-300' : 'text-rose-300'
              }`}>
                {strategy.sharpe.toFixed(1)}
              </div>
              <div className="text-right text-zinc-300">{strategy.turnover.toFixed(1)}x</div>
            </div>
          ))}
        </div>

        <div className="text-xs text-zinc-500">
          Live trading comparison • Shadow runs use historical data
        </div>
      </div>
    </Card>
  );
}

export function MarketRegimesPanel() {
  // Mock market regime clustering data
  const regimeData = useMemo(() => [
    { regime: 'High Momentum', vol: 2.1, spread: 1.8, pnl: 145 },
    { regime: 'Low Momentum', vol: 0.8, spread: 3.2, pnl: -45 },
    { regime: 'Trending Bull', vol: 1.6, spread: 2.1, pnl: 89 },
    { regime: 'Trending Bear', vol: 1.9, spread: 2.8, pnl: -67 },
    { regime: 'Range Bound', vol: 0.9, spread: 4.1, pnl: 23 },
    { regime: 'High Vol', vol: 3.2, spread: 1.2, pnl: -112 },
  ], []);

  return (
    <Card title="Market Regimes">
      <div className="space-y-4">
        <div className="text-xs text-zinc-400 mb-2">
          Market regime clustering (volume vs spread color-coded)
        </div>

        <div className="space-y-2">
          {regimeData.map((regime, i) => (
            <div key={regime.regime} className="flex items-center gap-3 bg-[#10131d] p-2 rounded">
              <div className="w-16 h-8 relative">
                {/* Scatter plot bubble */}
                <div
                  className={`absolute rounded-full border-2 ${
                    regime.pnl > 0 ? 'border-emerald-400 bg-emerald-400/20' : 'border-rose-400 bg-rose-400/20'
                  }`}
                  style={{
                    left: `${(regime.vol / 3.5) * 60}px`,
                    top: `${(Math.min(5, regime.spread) / 5) * 24}px`,
                    width: `${8 + Math.abs(regime.pnl) / 20}px`,
                    height: `${8 + Math.abs(regime.pnl) / 20}px`
                  }}
                  title={`Vol: ${regime.vol}, Spread: ${regime.spread}, PnL: ${regime.pnl}`}
                />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-zinc-200">{regime.regime}</div>
                <div className="text-xs text-zinc-400">
                  Vol: {regime.vol.toFixed(1)} • Spread: {regime.spread.toFixed(1)} bps • Alpha: {regime.pnl >= 0 ? '+' : ''}{regime.pnl}bps
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-zinc-500">
          Clustering based on realized variance and spread costs
        </div>
      </div>
    </Card>
  );
}

export function DrawdownAnalysisPanel() {
  const ddData = useMemo(() => ({
    depthDistribution: [
      { range: '0-1%', count: 45, pct: 60 },
      { range: '1-2%', count: 20, pct: 27 },
      { range: '2-3%', count: 8, pct: 11 },
      { range: '3-5%', count: 2, pct: 2.7 },
      { range: '>5%', count: 0, pct: 0 }
    ],
    durationDistribution: [
      { range: '<1h', count: 32, pct: 43 },
      { range: '1-4h', count: 28, pct: 37 },
      { range: '4-8h', count: 10, pct: 13 },
      { range: '8-24h', count: 5, pct: 6.7 },
      { range: '>24h', count: 0, pct: 0 }
    ],
    stats: {
      worstDepth: -3.2,
      worstDuration: '6.5h',
      recoveryTime: '2.8h',
      avgDepth: -0.8,
      maxConcurrent: 3
    }
  }), []);

  return (
    <Card title="Drawdown Analysis">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-medium text-zinc-300 mb-2">Depth Distribution</div>
            <div className="space-y-1">
              {ddData.depthDistribution.map((d, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">{d.range}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-12 bg-zinc-800 rounded-sm">
                      <div className="bg-rose-600 h-1 rounded-sm" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="text-zinc-300 w-6">{d.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-zinc-300 mb-2">Duration Distribution</div>
            <div className="space-y-1">
              {ddData.durationDistribution.map((d, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">{d.range}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-12 bg-zinc-800 rounded-sm">
                      <div className="bg-amber-600 h-1 rounded-sm" style={{ width: `${d.pct}%` }} />
                    </div>
                    <span className="text-zinc-300 w-6">{d.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-rose-300">{ddData.stats.worstDepth}%</div>
            <div className="text-xs text-zinc-400">Worst Depth</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-amber-300">{ddData.stats.worstDuration}</div>
            <div className="text-xs text-zinc-400">Worst Duration</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-emerald-300">{ddData.stats.recoveryTime}</div>
            <div className="text-xs text-zinc-400">Avg Recovery</div>
          </div>
        </div>

        <div className="text-xs text-zinc-500">
          Based on {ddData.depthDistribution.reduce((sum, d) => sum + d.count, 0)} drawdown events
        </div>
      </div>
    </Card>
  );
}

export function ExpectancyCalculatorPanel() {
  const [params, setParams] = useState({
    winRate: 55,
    avgWin: 150,
    avgLoss: 80
  });

  const expectancy = useMemo(() => {
    const winRateDec = params.winRate / 100;
    const lossRateDec = 1 - winRateDec;
    const expectedValue = (winRateDec * params.avgWin) - (lossRateDec * params.avgLoss);
    const expectancyRatio = expectedValue / params.avgLoss; // $ expectancy per $ risked
    const edge = params.avgWin * winRateDec - params.avgLoss * lossRateDec;

    return {
      expectedValue,
      expectancyRatio,
      edge,
      riskRewardRatio: params.avgWin / params.avgLoss,
      confidence95: `$${Math.round(expectedValue * 0.95)} - $${Math.round(expectedValue * 1.05)}` // Simplified CI
    };
  }, [params]);

  const handleParamChange = (key: keyof typeof params, value: string) => {
    const numValue = parseFloat(value) || 0;
    setParams(prev => ({ ...prev, [key]: numValue }));
  };

  return (
    <Card title="Expectancy Calculator">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(params).map(([key, value]) => (
            <div key={key}>
              <label className="block text-xs text-zinc-400 mb-1 capitalize">
                {key.replace(/([A-Z])/g, ' $1')}
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => handleParamChange(key as keyof typeof params, e.target.value)}
                className="w-full px-2 py-1 text-sm text-zinc-200 bg-[#10131d] border border-zinc-700 rounded focus:border-cyan-400 focus:outline-none"
              />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className={`text-xl font-semibold mb-1 ${expectancy.expectedValue >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {formatUsd(expectancy.expectedValue)}
              </div>
              <div className="text-xs text-zinc-400">Expected Value</div>
              <div className="text-xs text-zinc-500 mt-1">per trade</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-semibold text-cyan-300 mb-1">
                {expectancy.expectancyRatio.toFixed(2)}
              </div>
              <div className="text-xs text-zinc-400">Expectancy Ratio</div>
              <div className="text-xs text-zinc-500 mt-1">per dollar risked</div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Edge:</span>
              <span className={`font-semibold ${expectancy.edge >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {formatUsd(expectancy.edge)}/trade
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Risk-Reward Ratio:</span>
              <span className="font-semibold text-zinc-300">
                1:{expectancy.riskRewardRatio.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">95% Confidence:</span>
              <span className="font-semibold text-zinc-300">{expectancy.confidence95}</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-zinc-500">
          Formula: (Win Rate × Avg Win) - ((1 - Win Rate) × Avg Loss)
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
