'use client';

import { useMemo } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

export function RiskMetricsPanel() {
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const guardrailCounts = useTelemetryStore((state) => state.guardrailCounts);

  const { summaryCards, tableRows } = useMemo(() => {
    const latest = guardrails[0];
    const severityCount = guardrails.reduce(
      (acc, item) => {
        acc[item.severity] = (acc[item.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const cards = [
      {
        label: 'Blocks',
        value: (severityCount['block'] ?? 0).toString(),
        tone: 'text-rose-300',
        sub: latest && latest.severity === 'block' ? latest.rule : undefined,
      },
      {
        label: 'Warnings',
        value: (severityCount['warn'] ?? 0).toString(),
        tone: 'text-amber-300',
        sub: latest ? latest.message : undefined,
      },
      {
        label: 'Info',
        value: (severityCount['info'] ?? 0).toString(),
        tone: 'text-sky-300',
        sub: latest ? new Date(latest.ts).toLocaleTimeString() : undefined,
      },
    ];
    const rows = Object.entries(guardrailCounts).map(([rule, count]) => ({ rule, count }));
    rows.sort((a, b) => b.count - a.count);
    return { summaryCards: cards, tableRows: rows };
  }, [guardrails, guardrailCounts]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
        <h2 className="text-lg font-semibold text-white">Risk Dashboard</h2>
        <p className="text-sm text-zinc-500">Guardrail activity and alert history from the live pipeline.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="text-xs uppercase tracking-wider text-zinc-500">{card.label}</div>
              <div className={`mt-2 text-xl font-semibold ${card.tone}`}>{card.value}</div>
              {card.sub && <div className="mt-1 text-xs text-zinc-400">{card.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70">
        <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Guardrail Reason Summary</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-900/80 text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Rule</th>
                <th className="px-4 py-2 text-right font-medium">Count</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-center text-zinc-500" colSpan={2}>No guardrail activity yet.</td>
                </tr>
              ) : (
                tableRows.map((row) => (
                  <tr key={row.rule} className="border-t border-zinc-800 text-white">
                    <td className="px-4 py-2 font-medium">{row.rule}</td>
                    <td className="px-4 py-2 text-right">{row.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
