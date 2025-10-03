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

export function StatesReturnsCard() {
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

  const getStateColor = (state: number) => {
    switch (state) {
      case 0: return 'text-red-400';    // Bearish
      case 1: return 'text-yellow-400'; // Neutral
      case 2: return 'text-green-400';  // Bullish
      default: return 'text-zinc-400';
    }
  };

  const getStateName = (state: number) => {
    switch (state) {
      case 0: return 'BEARISH';
      case 1: return 'NEUTRAL';
      case 2: return 'BULLISH';
      default: return 'UNKNOWN';
    }
  };

  const getConfidenceLevel = (probability: number) => {
    if (probability >= 0.8) return 'HIGH';
    if (probability >= 0.6) return 'MEDIUM';
    return 'LOW';
  };

  const shouldShowLiveOverlay = TRADING_MODE === 'live';

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">States & Returns</div>
      <div className="flex-1 flex items-center justify-center">
        {!shouldShowLiveOverlay ? (
          <div className="text-zinc-500 text-sm text-center">
            States & Returns Analytics
            <br />
            <span className="text-xs text-zinc-600">Live overlay available in live mode</span>
          </div>
        ) : !latestHmm ? (
          <div className="text-zinc-500 text-sm">
            Waiting for HMM signals...
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            {/* Main State Indicator */}
            <div className="text-center">
              <div className={`text-2xl font-bold ${getStateColor(latestHmm.state)}`}>
                {getStateName(latestHmm.state)}
              </div>
              <div className="text-lg font-semibold text-zinc-300 mt-1">
                {activeSymbol}
              </div>
            </div>

            {/* Confidence Meter */}
            <div className="flex flex-col items-center space-y-2">
              <div className="text-xs text-zinc-400 uppercase">Confidence</div>
              <div className="flex items-center space-x-2">
                <div className="w-24 h-2 bg-zinc-700 rounded">
                  <div
                    className="h-full bg-green-500 rounded transition-all duration-300"
                    style={{ width: `${latestHmm.probability * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-zinc-300 min-w-[3ch]">
                  {Math.round(latestHmm.probability * 100)}%
                </span>
              </div>
              <div className={`text-xs font-medium ${
                latestHmm.probability >= 0.8 ? 'text-green-400' :
                latestHmm.probability >= 0.6 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {getConfidenceLevel(latestHmm.probability)} CONFIDENCE
              </div>
            </div>

            {/* Probability Graph Placeholder */}
            <div className="w-full h-16 bg-zinc-800/50 rounded border border-zinc-700 flex items-center justify-center">
              <div className="text-xs text-zinc-500">
                Win Probability Graph<br/>
                <span className="text-zinc-600">+{Math.round((latestHmm.probability - 0.5) * 200)}% vs random</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
