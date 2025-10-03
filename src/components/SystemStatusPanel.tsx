'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

type StatusCard = { label: string; value: string; tone: string; sub?: string };

export function SystemStatusPanel() {
  const lastTickAt = useTelemetryStore((state) => state.lastTickAt);
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const markov = useTelemetryStore((state) => state.markov);
  const [mlStatus, setMlStatus] = useState<'ok' | 'down' | 'unknown'>('unknown');
  const bridgeStatus = useTelemetryStore((state) => state.bridgeStatus);

  useEffect(() => {
    let cancelled = false;
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' });
        if (!res.ok) throw new Error('health status not ok');
        const json = await res.json();
        if (cancelled) return;
        setMlStatus(json?.ml?.ok ? 'ok' : 'down');
      } catch {
        if (!cancelled) setMlStatus('down');
      }
    };
    fetchHealth();
    const id = setInterval(fetchHealth, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const cards: StatusCard[] = useMemo(() => {
    const now = Date.now();
    const tickSeconds = lastTickAt ? Math.max(0, (now - lastTickAt) / 1000) : null;
    const lastGuardrail = guardrails[0];
    const guardrailSeconds = lastGuardrail ? Math.max(0, (now - lastGuardrail.ts) / 1000) : null;
    const stateLabels = ['Down', 'Flat', 'Up'] as const;
    const markovState = (typeof markov === 'object' && markov !== null && 'lastState' in markov && typeof markov.lastState === 'number')
      ? stateLabels[markov.lastState as 0 | 1 | 2] ?? '—'
      : '—';

    const mlCard: StatusCard = {
      label: 'ML Service',
      value: mlStatus === 'ok' ? 'Online' : mlStatus === 'down' ? 'Offline' : '—',
      tone: mlStatus === 'ok' ? 'text-emerald-300' : mlStatus === 'down' ? 'text-rose-300' : 'text-zinc-300',
      sub: mlStatus === 'ok' ? 'Inference ready' : 'Check FastAPI service',
    };

    return [
      {
        label: 'Bridge',
        value: bridgeStatus === 'connected' ? 'Connected' : 'Disconnected',
        tone: bridgeStatus === 'connected' ? 'text-emerald-300' : 'text-rose-300',
        sub: bridgeStatus === 'connected' ? 'SSE link active' : 'Waiting for events',
      },
      {
        label: 'Tick Stream',
        value: tickSeconds !== null ? `${tickSeconds.toFixed(1)}s ago` : 'waiting…',
        tone: tickSeconds !== null && tickSeconds < 3 ? 'text-emerald-300' : 'text-rose-300',
        sub: tickSeconds !== null ? 'Latest heartbeat' : 'Start bridge',
      },
      {
        label: 'Guardrail Alerts',
        value: guardrailSeconds !== null ? `${guardrailSeconds.toFixed(1)}s ago` : 'none',
        tone: lastGuardrail ? 'text-amber-300' : 'text-zinc-300',
        sub: lastGuardrail ? lastGuardrail.message : 'All guardrails clear',
      },
      {
        label: 'Current Regime',
        value: markovState,
        tone: markovState === 'Up'
          ? 'text-emerald-300'
          : markovState === 'Down'
            ? 'text-rose-300'
            : 'text-sky-300',
        sub: (typeof markov === 'object' && markov !== null && 'ts' in markov && typeof markov.ts === 'number') ? new Date(markov.ts).toLocaleTimeString() : 'Awaiting model',
      },
      mlCard,
    ];
  }, [bridgeStatus, guardrails, lastTickAt, markov, mlStatus]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(card => (
        <div key={card.label} className="rounded-md border border-[#1a1d28] bg-[#0d101a] p-4">
          <div className="text-[11px] uppercase tracking-widest text-zinc-500">{card.label}</div>
          <div className={`mt-2 text-lg font-semibold ${card.tone}`}>{card.value}</div>
          {card.sub && <div className="mt-1 text-xs text-zinc-400">{card.sub}</div>}
        </div>
      ))}
    </div>
  );
}
