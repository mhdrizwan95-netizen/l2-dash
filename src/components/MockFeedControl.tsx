'use client';

import { useCallback, useMemo } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

export function MockFeedControl({ symbol = 'BTC' }: { symbol?: string }) {
  const tickEntry = useTelemetryStore((state) => state.ticks[symbol ?? 'BTC']);
  const lastTickAt = useTelemetryStore((state) => state.lastTickAt);

  const stale = useMemo(() => {
    if (!lastTickAt) return false;
    return Date.now() - lastTickAt > 5000;
  }, [lastTickAt]);

  const toggle = useCallback(() => {
    console.warn('Mock feed has been removed. Use IBKR paper/live data instead.');
  }, []);

  const status = (() => {
    if (tickEntry) {
      const age = lastTickAt ? Date.now() - lastTickAt : Infinity;
      if (age < 2000) return 'Streaming ticks';
      return stale ? 'Feed stale — check blotter connection' : 'Awaiting next tick…';
    }
    return 'Waiting for live data';
  })();

  return (
    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
      <div>
        <div className="text-xs text-zinc-500 uppercase tracking-wide">Data Stream</div>
        <div className="text-lg font-semibold text-white">
          {tickEntry ? `${symbol} $${tickEntry.price.toFixed(2)}` : '—'}
        </div>
        <div className="text-xs text-zinc-500">
          {status}
          {lastTickAt && ` · last ${new Date(lastTickAt).toLocaleTimeString()}`}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled
        className="px-3 py-1.5 rounded-lg text-sm bg-zinc-800 text-zinc-500 cursor-not-allowed"
      >
        Configure Feed
      </button>
    </div>
  );
}
