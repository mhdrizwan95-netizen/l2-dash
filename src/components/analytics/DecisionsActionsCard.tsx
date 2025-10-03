'use client';

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

// Combined Decisions & Actions Analytics Card
export function DecisionsActionsCard() {
  const recentDecisions = [
    { symbol: 'AAPL', action: 'BUY', qty: 25, reason: 'Signal +2.3σ', outcome: 'Executed', time: '09:43' },
    { symbol: 'MSFT', action: 'SELL', qty: 20, reason: 'Guardrails', outcome: 'Rejected', time: '10:12' },
    { symbol: 'NVDA', action: 'BUY', qty: 15, reason: 'Momentum > 0.8', outcome: 'Executed', time: '10:28' },
    { symbol: 'TSLA', action: 'SELL', qty: 10, reason: 'Drawdown limit', outcome: 'Rejected', time: '11:01' }
  ];

  const successRate = recentDecisions.filter(d => d.outcome === 'Executed').length / recentDecisions.length * 100;

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Decisions & Actions</div>

      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-2 gap-1.5 text-center">
          <div className="p-1.5 rounded bg-[#10131d]">
            <div className="text-sm font-bold text-emerald-300">{successRate.toFixed(0)}%</div>
            <div className="text-xs text-zinc-400">Success Rate</div>
          </div>
          <div className="p-1.5 rounded bg-[#10131d]">
            <div className="text-sm font-bold text-cyan-300">{recentDecisions.length}</div>
            <div className="text-xs text-zinc-400">Recent Decisions</div>
          </div>
        </div>

        <div className="flex-1">
          <div className="text-xs text-zinc-500 mb-1.5">Recent Actions</div>
          <div className="space-y-1.5">
            {recentDecisions.map((decision, i) => (
              <div key={i} className="flex justify-between items-center text-xs bg-[#10131d] px-2 py-1.5 rounded">
                <div className="flex items-center gap-2 flex-1">
                  <span className="font-medium text-zinc-200">{decision.symbol}</span>
                  <span className={`text-xs px-1 py-0.5 rounded ${
                    decision.action === 'BUY' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'
                  }`}>
                    {decision.action}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`font-medium ${
                    decision.outcome === 'Executed' ? 'text-emerald-300' : 'text-rose-300'
                  }`}>
                    {decision.outcome}
                  </span>
                  <div className="text-zinc-500 text-[10px]">{decision.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
