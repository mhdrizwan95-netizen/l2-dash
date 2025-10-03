'use client';

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

// Combined PnL & Price Analytics Card
export function PnlPriceCard() {
  // Mock analytics data
  const positions = [
    { symbol: 'AAPL', qty: 100, avgPx: 150.2, lastPx: 152.8, pnl: 260, change: 2.6, changePct: 1.7 },
    { symbol: 'MSFT', qty: -50, avgPx: 280.5, lastPx: 275.2, pnl: -265, change: -5.3, changePct: -1.9 },
    { symbol: 'NVDA', qty: 25, avgPx: 450.0, lastPx: 468.5, pnl: 463, change: 18.5, changePct: 4.1 }
  ];

  const pnlTimeline = [
    { time: '09:30', pnl: 120 },
    { time: '10:00', pnl: -50 },
    { time: '10:30', pnl: 220 },
    { time: '11:00', pnl: -80 },
    { time: '11:30', pnl: 180 }
  ];

  const totalUnrealized = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalRealized = -1250;
  const totalPnL = totalRealized + totalUnrealized;

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">PnL & Price</div>

      <div className="flex-1 space-y-3">
        {/* P&L Summary */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="p-1.5 rounded bg-[#10131d]">
            <div className={`text-sm font-bold ${totalUnrealized >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {formatUsd(totalUnrealized)}
            </div>
            <div className="text-xs text-zinc-400">Unrealized</div>
          </div>
          <div className="p-1.5 rounded bg-[#10131d]">
            <div className={`text-sm font-bold ${totalRealized >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {formatUsd(totalRealized)}
            </div>
            <div className="text-xs text-zinc-400">Realized</div>
          </div>
          <div className="p-1.5 rounded bg-[#10131d]">
            <div className={`text-sm font-bold ${totalPnL >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {formatUsd(totalPnL)}
            </div>
            <div className="text-xs text-zinc-400">Total</div>
          </div>
        </div>

        {/* Recent Positions */}
        <div className="flex-1">
          <div className="text-xs text-zinc-500 mb-1.5">Current Positions</div>
          <div className="space-y-1.5">
            {positions.map((pos) => (
              <div key={pos.symbol} className="flex justify-between items-center text-xs bg-[#10131d] px-2 py-1.5 rounded">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-200">{pos.symbol}</span>
                  <span className={`text-xs px-1 py-0.5 rounded ${
                    pos.qty > 0 ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {pos.qty > 0 ? `${pos.qty}L` : `${-pos.qty}S`}
                  </span>
                </div>
                <div className="text-right">
                  <div className={`font-medium ${pos.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {formatUsd(pos.pnl)}
                  </div>
                  <div className="text-zinc-500 text-[10px]">
                    {pos.change >= 0 ? '+' : ''}{pos.change.toFixed(1)} ({pos.changePct.toFixed(1)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* P&L Timeline Sparkline */}
        <div className="pt-1 border-t border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Intraday P&L</div>
          <div className="h-8 bg-[#10131d] rounded">
            <div className="h-full w-full relative">
              <svg viewBox="0 0 100 30" className="w-full h-full">
                <polyline
                  points="0,25 20,20 40,10 60,8 80,6 100,15"
                  stroke="rgb(52, 211, 153)"
                  strokeWidth="1.5"
                  fill="none"
                />
              </svg>
            </div>
          </div>
          <div className="flex justify-between text-xs text-zinc-500">
            <span>9:30</span>
            <span>Midday</span>
          </div>
        </div>
      </div>
    </div>
  );
}
