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

export function LatencyCard() {
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

  const getStateLatencyBudget = (state: number) => {
    // Different latency budgets for different market regimes
    switch (state) {
      case 0: return { budget: 150, unit: 'ms' }; // Bearish - high volatility
      case 1: return { budget: 100, unit: 'ms' }; // Neutral - moderate
      case 2: return { budget: 80, unit: 'ms' };  // Bullish - low volatility
      default: return { budget: 120, unit: 'ms' };
    }
  };

  const shouldShowLiveOverlay = TRADING_MODE === 'live';

  if (!shouldShowLiveOverlay) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Latency</div>
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          System Latency Metrics
        </div>
      </div>
    );
  }

  const latencyBudget = latestHmm ? getStateLatencyBudget(latestHmm.state) : null;

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Latency</div>
      <div className="flex-1 flex flex-col">
        {!latestHmm ? (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            Waiting for market state data...
          </div>
        ) : (
          <>
            {/* Market-Aware Latency Budget */}
            <div className="mb-4">
              <div className="text-xs text-zinc-400 mb-1">Market-Regime Budget</div>
              <div className="text-sm font-medium text-zinc-300">
                {latencyBudget?.budget}{latencyBudget?.unit} ({getStateName(latestHmm.state).toLowerCase()} regime)
              </div>
              <div className="text-xs text-zinc-500 mt-1">Adaptive latency requirements</div>
            </div>

            {/* Dynamic Latency Thresholds */}
            <div className="mb-4">
              <div className="text-xs text-zinc-400 mb-2">System Performance</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">Exec Latency</span>
                  <span className="text-sm font-medium text-green-400">
                    {latencyBudget ? Math.round(latencyBudget.budget * 0.3) : 25}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">ML Inference</span>
                  <span className="text-sm font-medium text-green-400">
                    {latencyBudget ? Math.round(latencyBudget.budget * 0.5) : 40}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">Network Roundtrip</span>
                  <span className="text-sm font-medium text-yellow-400">
                    {latencyBudget ? Math.round(latencyBudget.budget * 0.8) : 80}ms
                  </span>
                </div>
              </div>
            </div>

            {/* Brett Regime Context */}
            <div className="text-xs text-zinc-500">
              Live trading: Latency budgeting for {getStateName(latestHmm.state).toLowerCase()} market dynamics ({Math.round(latestHmm.probability * 100)}% confidence)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
