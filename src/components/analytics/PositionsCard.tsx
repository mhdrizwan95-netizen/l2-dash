'use client';

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

// Positions Analytics Card
export function PositionsCard() {
  const positions = [
    { symbol: 'AAPL', qty: 100, avgPx: 150.2, curPx: 152.8, unrealizedPnL: 260, realizedPnL: -50, age: '2h 30m' },
    { symbol: 'MSFT', qty: -75, avgPx: 280.5, curPx: 275.2, unrealizedPnL: -390, realizedPnL: 250, age: '4h 15m' },
    { symbol: 'NVDA', qty: 50, avgPx: 450.0, curPx: 468.5, unrealizedPnL: 925, realizedPnL: -100, age: '1h 45m' },
    { symbol: 'TSLA', qty: -30, avgPx: 310.8, curPx: 282.1, unrealizedPnL: -862, realizedPnL: 180, age: '45m' },
    { symbol: 'PLTR', qty: 200, avgPx: 19.2, curPx: 18.9, unrealizedPnL: -600, realizedPnL: 100, age: '3h 20m' }
  ];

  const totalUnrealized = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  const totalRealized = positions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
  const totalPositions = positions.length;
  const winningPositions = positions.filter(p => p.unrealizedPnL + p.realizedPnL > 0).length;

  const sortedPositions = [...positions].sort((a, b) =>
    Math.abs(b.unrealizedPnL) - Math.abs(a.unrealizedPnL)
  ).slice(0, 4);

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Positions</div>

      <div className="flex-1 space-y-3">
        {/* Position Summary */}
        <div className="grid grid-cols-2 gap-1.5 text-center">
          <div className="p-1.5 rounded bg-[#10131d]">
            <div className={`text-sm font-bold ${totalUnrealized >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {formatUsd(totalUnrealized)}
            </div>
            <div className="text-xs text-zinc-400">Unrealized P&L</div>
          </div>
          <div className="p-1.5 rounded bg-[#10131d]">
            <div className="text-sm font-bold text-cyan-300">
              {winningPositions}/{totalPositions}
            </div>
            <div className="text-xs text-zinc-400">Win Rate</div>
          </div>
        </div>

        {/* Position Details */}
        <div className="flex-1">
          <div className="text-xs text-zinc-500 mb-1.5">Top Positions</div>
          <div className="space-y-1.5 overflow-y-auto max-h-48">
            {sortedPositions.map((pos) => {
              const totalPnL = pos.unrealizedPnL + pos.realizedPnL;
              const pnlPercent = (totalPnL / (Math.abs(pos.qty) * pos.avgPx)) * 100;

              return (
                <div key={pos.symbol} className="flex justify-between items-center text-xs bg-[#10131d] px-2 py-1.5 rounded">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="font-medium text-zinc-200 truncate">{pos.symbol}</span>
                    <span className={`text-xs px-1 py-0.5 rounded flex-shrink-0 ${
                      pos.qty > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                    }`}>
                      {pos.qty > 0 ? '+' : ''}{pos.qty}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`font-medium ${totalPnL >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {formatUsd(totalPnL)}
                    </div>
                    <div className="text-zinc-500 text-[10px]">
                      {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%&nbsp;•&nbsp;{pos.age}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Position Analytics */}
        <div className="pt-1 border-t border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Position Performance</div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Long positions</span>
              <span className="text-zinc-300">
                {positions.filter(p => p.qty > 0).length} ({((positions.filter(p => p.qty > 0).length / positions.length) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Profitable</span>
              <span className="text-emerald-300">
                {winningPositions} ({((winningPositions / positions.length) * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-400">Avg hold time</span>
              <span className="text-zinc-300">2.5h</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
