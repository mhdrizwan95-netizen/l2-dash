'use client';

import { useGuardrails } from '@/lib/guardrailStore';
import { resetAllLayouts } from '@/lib/persist/layout';

export function TopBar() {
  const counters = useGuardrails((s) => s.counters);
  const latest = useGuardrails((s) => s.latest);

  const guardrails = ['SPREAD', 'POS', 'COOL', 'LAT', 'DD', 'KILL', 'CONF', 'DRIFT'] as const;

  const handleResetLayout = () => {
    if (confirm('This will reset all saved layouts (cockpit, analytics). Continue?')) {
      resetAllLayouts();
    }
  };

  return (
    <div className="flex h-8 items-center justify-between bg-slate-800 text-xs text-white px-2">
      {/* Status Pills */}
      <div className="flex gap-1">
        {guardrails.map((code) => {
          const count = counters[code] || 0;
          const isActive = latest?.reason === code;
          return (
            <div
              key={code}
              className={`px-2 py-1 rounded text-xs font-mono ${
                isActive
                  ? 'bg-red-600 text-white animate-pulse'
                  : count > 0
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-600 text-gray-300'
              }`}
            >
              {code}:{count}
            </div>
          );
        })}
      </div>

      {/* Right side: Reset Layout + Connection Status */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleResetLayout}
          className="px-2 py-0.5 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
          title="Reset all saved layouts (clears localStorage)"
        >
          Reset Layout
        </button>
        <div className="text-gray-400">
          SSE: Connected
        </div>
      </div>
    </div>
  );
}
