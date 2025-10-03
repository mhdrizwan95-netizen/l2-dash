'use client';

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

// Combined Exposure & Notional Analytics Card
export function ExposureNotionalCard() {
  const exposures = [
    { symbol: 'AAPL', qty: 100, px: 152.8, notional: 15280, pct: 34.2 },
    { symbol: 'MSFT', qty: -50, px: 275.2, notional: -13760, pct: -31.4 },
    { symbol: 'NVDA', qty: 25, px: 468.5, notional: 11712, pct: 26.4 },
    { symbol: 'TSLA', qty: -10, px: 295.6, notional: -2956, pct: -6.6 },
    { symbol: 'PLTR', qty: 75, px: 18.9, notional: 1418, pct: 3.2 }
  ];

  const totalLong = exposures.filter(e => e.qty > 0).reduce((sum, e) => sum + Math.abs(e.notional), 0);
  const totalShort = exposures.filter(e => e.qty < 0).reduce((sum, e) => sum + Math.abs(e.notional), 0);
  const netExposure = exposures.reduce((sum, e) => sum + e.notional, 0);
  const totalNotional = exposures.reduce((sum, e) => sum + Math.abs(e.notional), 0);

  const topExposures = exposures.sort((a, b) => Math.abs(b.notional) - Math.abs(a.notional)).slice(0, 3);

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Exposure & Notional</div>

      <div className="flex-1 space-y-3">
        {/* Exposure Summary */}
        <div className="grid grid-cols-2 gap-1.5 text-center">
          <div className="p-1.5 rounded bg-[#10131d]">
            <div className="text-sm font-bold text-green-300">{formatUsd(totalLong)}</div>
            <div className="text-xs text-zinc-400">Long Exposure</div>
          </div>
          <div className="p-1.5 rounded bg-[#10131d]">
            <div className="text-sm font-bold text-red-300">{formatUsd(totalShort)}</div>
            <div className="text-xs text-zinc-400">Short Exposure</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-center">
          <div className="p-1.5 rounded bg-[#10131d]">
            <div className={`text-sm font-bold ${netExposure >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {formatUsd(netExposure)}
            </div>
            <div className="text-xs text-zinc-400">Net</div>
          </div>
          <div className="p-1.5 rounded bg-[#10131d]">
            <div className="text-sm font-bold text-cyan-300">{formatUsd(totalNotional)}</div>
            <div className="text-xs text-zinc-400">Total Notional</div>
          </div>
        </div>

        {/* Top Exposures */}
        <div className="flex-1">
          <div className="text-xs text-zinc-500 mb-1.5">Top Exposures</div>
          <div className="space-y-1.5">
            {topExposures.map((exp) => (
              <div key={exp.symbol} className="flex justify-between items-center text-xs bg-[#10131d] px-2 py-1.5 rounded">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-200">{exp.symbol}</span>
                  <span className={`text-xs px-1 py-0.5 rounded ${
                    exp.qty > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {exp.qty > 0 ? `${exp.qty}L` : `${-exp.qty}S`}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`font-medium ${exp.notional >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {formatUsd(exp.notional)}
                  </div>
                  <div className="text-zinc-500 text-[10px]">
                    {exp.pct >= 0 ? '+' : ''}{exp.pct.toFixed(1)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Exposure Distribution */}
        <div className="pt-1 border-t border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Long/Short Balance</div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Long</span>
              <span className="text-green-300">{((totalLong / totalNotional) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded">
              <div
                className="h-full bg-green-500 rounded-l"
                style={{ width: `${(totalLong / totalNotional) * 100}%` }}
              />
              <div
                className="h-full bg-red-500 rounded-r"
                style={{ width: `${(totalShort / totalNotional) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Beta adjusted</span>
              <span className="text-blue-300">Neutral</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
