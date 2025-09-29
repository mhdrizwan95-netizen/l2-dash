'use client';

import { useMemo } from 'react';
import { useEventStream } from '@/hooks/useEventStream';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

type MarkovPayload = {
  counts: number[];
  P: number[][];
  lastState: 0 | 1 | 2 | null;
  next: [number, number, number] | null;
  ts: number;
};
type EventMsg =
  | { type: 'tick'; payload: any }
  | { type: 'markov'; payload: MarkovPayload }
  | { type: 'control'; payload: any };

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function cellColor(p: number) {
  // green intensity by probability
  const v = Math.round(clamp01(p) * 100);
  return `hsl(145 70% ${30 + v * 0.5}%)`;
}

export default function MarkovPanel() {
  const evt = useEventStream<EventMsg>();
  const markov = useMemo(() => (evt?.type === 'markov' ? evt.payload as MarkovPayload : null), [evt]);

  const matrix = markov?.P ?? [[0,0,0],[0,0,0],[0,0,0]];
  const next = markov?.next ?? null;
  const lastState = markov?.lastState ?? null;

  const nextData = next
    ? [{ name: 'Down', p: next[0] }, { name: 'Flat', p: next[1] }, { name: 'Up', p: next[2] }]
    : [{ name: 'Down', p: 0 }, { name: 'Flat', p: 0 }, { name: 'Up', p: 0 }];

  return (
    <div className="grid gap-6 md:grid-cols-2 p-6">
      {/* Matrix heatmap (simple table = fast + clear) */}
      <div className="rounded-2xl shadow p-4 border">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Markov Transition Matrix (3×3)</h2>
          <span className="text-xs text-gray-500">{markov ? new Date(markov.ts).toLocaleTimeString() : '—'}</span>
        </div>
        <div className="text-xs text-gray-500 mb-2">Rows = from-state, Columns = to-state</div>
        <div className="overflow-x-auto">
          <table className="min-w-[360px] text-sm">
            <thead>
              <tr>
                <th className="text-left p-2">From \ To</th>
                <th className="p-2">Down</th>
                <th className="p-2">Flat</th>
                <th className="p-2">Up</th>
              </tr>
            </thead>
            <tbody>
              {['Down','Flat','Up'].map((rowLabel, r) => (
                <tr key={rowLabel} className="border-t">
                  <td className="p-2 font-medium">
                    {rowLabel}{lastState === r ? ' •' : ''}
                  </td>
                  {matrix[r].map((p, c) => (
                    <td key={c} className="p-0">
                      <div
                        className="text-center text-xs py-3"
                        style={{ background: cellColor(p), color: p > 0.55 ? 'white' : 'black' }}
                        title={`P(${rowLabel}→${['Down','Flat','Up'][c]})=${p.toFixed(3)}`}
                      >
                        {p ? (p*100).toFixed(1)+'%' : '—'}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-gray-600">
          Last state: <b>{lastState === null ? 'none' : ['Down','Flat','Up'][lastState]}</b>
        </div>
      </div>

      {/* Next-state odds bar chart */}
      <div className="rounded-2xl shadow p-4 border">
        <h2 className="font-semibold mb-3">Next-State Probabilities</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={nextData} layout="vertical" margin={{ left: 30, right: 12 }}>
              <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v*100)}%`} />
              <YAxis type="category" dataKey="name" />
              <Tooltip formatter={(v:number) => `${(v*100).toFixed(2)}%`} />
              <Bar dataKey="p" unit="" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!next && <div className="text-xs text-gray-500 mt-2">Waiting for two ticks to form first transition…</div>}
      </div>
    </div>
  );
}
