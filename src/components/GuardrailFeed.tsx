'use client';

import { useMemo } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

export type GuardrailEvent = {
  id: string;
  ts: number;
  rule: string;
  message: string;
  severity: 'info' | 'warn' | 'block';
  symbol?: string;
};

const severityStyles: Record<GuardrailEvent['severity'], string> = {
  info: 'bg-sky-500/15 text-sky-200 border-sky-500/40',
  warn: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  block: 'bg-rose-500/15 text-rose-200 border-rose-500/40',
};

export function GuardrailFeed({ limit = 40, symbol }: { limit?: number; symbol?: string | null }) {
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const events = useMemo(() => {
    const filtered = symbol ? guardrails.filter((g) => !g.symbol || g.symbol === symbol) : guardrails;
    return filtered.slice(0, limit);
  }, [guardrails, limit, symbol]);
  const empty = useMemo(() => events.length === 0, [events]);

  const getSeverityIcon = (severity: GuardrailEvent['severity']) => {
    switch (severity) {
      case 'block': return '🚫';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '🔔';
    }
  };

  const getSeverityColor = (severity: GuardrailEvent['severity']) => {
    switch (severity) {
      case 'block': return 'text-red-400';
      case 'warn': return 'text-amber-400';
      case 'info': return 'text-blue-400';
      default: return 'text-zinc-400';
    }
  };

  if (empty) {
    return <div className="text-sm text-zinc-500 flex items-center gap-2"><span>🔔</span>No guardrail alerts yet. Start the mock feed to exercise checks.</div>;
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
      {/* Critical alerts banner */}
      {events.filter(ev => ev.severity === 'block').length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-xs text-red-300 flex items-center gap-2">
          <span>🚨</span>
          <span className="font-semibold">{events.filter(ev => ev.severity === 'block').length} critical block{events.filter(ev => ev.severity === 'block').length !== 1 ? 's' : ''} active</span>
        </div>
      )}

      {/* Alert list */}
      <div className="space-y-2">
        {events.map(ev => (
          <div key={ev.id} className={`rounded-lg border px-3 py-2.5 ${severityStyles[ev.severity]} hover:bg-opacity-50 transition-colors`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <span className={`text-lg mt-0.5 ${getSeverityColor(ev.severity)}`}>
                  {getSeverityIcon(ev.severity)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono uppercase bg-zinc-800/50 px-1.5 py-0.5 rounded text-[10px]">
                        {ev.rule}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        ev.severity === 'block' ? 'bg-red-500/20 text-red-300' :
                        ev.severity === 'warn' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                        {ev.severity}
                      </span>
                    </div>
                    <span className="font-mono text-[10px]">
                      {new Date(ev.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm text-white leading-relaxed">
                    <span className="font-semibold mr-2 text-zinc-300">
                      {ev.symbol || 'SYSTEM'}
                    </span>
                    {ev.message}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {ev.severity === 'warn' && (
                  <button
                    className="px-2 py-1 text-xs rounded border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 transition-colors"
                    title="Acknowledge warning"
                  >
                    ✓
                  </button>
                )}
                {ev.severity === 'block' && (
                  <button
                    className="px-2 py-1 text-xs rounded border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-colors"
                    title="Force override"
                  >
                    ⚡
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Auto-scroll indicator */}
      <div className="text-center py-2">
        <div className="text-xs text-zinc-500 flex items-center justify-center gap-2">
          <span>⟲</span>
          Auto-scrolling enabled - {events.length} alert{events.length !== 1 ? 's' : ''} loaded
        </div>
      </div>
    </div>
  );
}
