'use client';

import { useState } from 'react';
import { useActiveSymbol } from '@/lib/telemetryStore';
import { useDevSseHmmStates } from '@/lib/devSseClient';
import { TRADING_MODE } from '@/lib/featureFlags';

type HmmState = {
  state: number;
  probability: number;
  symbol: string;
  timestamp: number;
};

export function ModelHealthCard() {
  const activeSymbol = useActiveSymbol();
  const [latestHmm, setLatestHmm] = useState<HmmState | null>(null);

  // Use SSE client to listen for HMM state events directly
  useDevSseHmmStates((event) => {
    if (event.symbol === activeSymbol) {
      setLatestHmm({
        state: event.state,
        probability: event.probability,
        symbol: event.symbol,
        timestamp: event.timestamp
      });
    }
  });

  const getStateName = (state: number) => {
    switch (state) {
      case 0: return 'BEARISH';
      case 1: return 'NEUTRAL';
      case 2: return 'BULLISH';
      default: return 'UNKNOWN';
    }
  };

  const shouldShowLiveOverlay = TRADING_MODE === 'live';

  if (!shouldShowLiveOverlay) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Model Health</div>
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          Model Health Metrics
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Model Health</div>
      <div className="flex-1 flex flex-col">
        {!latestHmm ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            Waiting for HMM model data...
          </div>
        ) : (
          <>
            {/* Market State Impact */}
            <div className="mb-4">
              <div className="text-xs text-zinc-400 mb-1">Market State</div>
              <div className="text-sm font-medium text-zinc-300">{getStateName(latestHmm.state)} ({activeSymbol})</div>
              <div className="text-xs text-zinc-500 mt-1">Model confidence: {Math.round(latestHmm.probability * 100)}%</div>
            </div>

            {/* Model Health Status */}
            <div className="mb-4">
              <div className="text-xs text-zinc-400 mb-2">Model Status</div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">Signal Quality</span>
                <span className={`text-sm font-medium ${latestHmm.probability >= 0.8 ? 'text-green-400' : latestHmm.probability >= 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {latestHmm.probability >= 0.8 ? 'EXCELLENT' : latestHmm.probability >= 0.6 ? 'GOOD' : 'POOR'}
                </span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2 mt-2">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${latestHmm.probability * 100}%` }}
                />
              </div>
            </div>

            {/* Live Trading Context */}
            <div className="text-xs text-zinc-500">
              Live mode: Model adapting to {getStateName(latestHmm.state).toLowerCase()} market conditions
            </div>
          </>
        )}
      </div>
    </div>
  );
}
