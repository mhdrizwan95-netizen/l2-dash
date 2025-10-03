'use client';

import { useGuardrails } from '@/lib/guardrailStore';
import { useCockpitStore } from '@/lib/cockpitStore';
import { useEffect, useRef } from 'react';

export function BottomBar() {
  const log = useGuardrails((s) => s.log);
  const { tradingEnabled, actions } = useCockpitStore();
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const handleKill = () => {
    if (window.confirm('⚠️ KILL SWITCH: This will flatten ALL positions and disable trading. Are you sure?')) {
      actions.kill();
    }
  };

  const handleFlattenAll = () => {
    if (window.confirm('Flatten ALL open positions? This will close all trades.')) {
      actions.flatten();
    }
  };

  const handleReconnect = () => {
    if (window.confirm('Attempt to reconnect to trading systems?')) {
      actions.reconnect();
    }
  };

  return (
    <div className="h-32 bg-slate-900 border-t border-slate-700 overflow-hidden flex flex-col">
      {/* Controls section */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-800">
        <div className="flex gap-2">
          <button
            onClick={handleKill}
            disabled={!tradingEnabled}
            className={`px-3 py-1 text-sm font-semibold rounded transition-colors ${
              tradingEnabled
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
            title="Kill switch - flattens all positions and disables trading"
          >
            KILL
          </button>
          <button
            onClick={handleFlattenAll}
            disabled={!tradingEnabled}
            className={`px-3 py-1 text-sm font-semibold rounded transition-colors ${
              tradingEnabled
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
            title="Flatten all positions"
          >
            FLATTEN ALL
          </button>
          <button
            onClick={handleReconnect}
            disabled={!tradingEnabled}
            className={`px-3 py-1 text-sm font-semibold rounded transition-colors ${
              tradingEnabled
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
            title="Reconnect to trading systems"
          >
            RECONNECT
          </button>
        </div>
        <div className="text-xs text-gray-400">
          Trading: <span className={tradingEnabled ? 'text-green-400' : 'text-red-400'}>
            {tradingEnabled ? 'ENABLED' : 'DISABLED'}
          </span>
        </div>
      </div>

      {/* Log section */}
      <div
        ref={logRef}
        className="flex-1 overflow-y-auto text-xs font-mono p-2 space-y-1"
      >
        {log.map((entry, index) => (
          <div
            key={`${entry.ts}-${index}`}
            className="text-gray-300 hover:bg-slate-800 px-1 rounded"
          >
            <span className="text-blue-400">
              {new Date(entry.ts).toLocaleTimeString()}
            </span>
            <span className="text-red-400 ml-2">
              {entry.reason}
            </span>
            <span className="ml-2">
              {entry.detail || `Activated for ${entry.symbol}`}
            </span>
          </div>
        ))}
        {log.length === 0 && (
          <div className="text-gray-500 italic">No guardrail events yet...</div>
        )}
      </div>
    </div>
  );
}
