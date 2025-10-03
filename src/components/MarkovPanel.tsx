'use client';

import { useTelemetryStore } from '@/lib/telemetryStore';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function cellColor(p: number) {
  // green intensity by probability
  const v = Math.round(clamp01(p) * 100);
  return `hsl(145 70% ${30 + v * 0.5}%)`;
}

export default function MarkovPanel() {
  const markov = useTelemetryStore((state) => state.markov);

  const matrix = (typeof markov === 'object' && markov !== null && 'P' in markov && Array.isArray(markov.P)) ? markov.P as number[][] : [[0,0,0],[0,0,0],[0,0,0]];
  const next = (typeof markov === 'object' && markov !== null && 'next' in markov && Array.isArray(markov.next)) ? markov.next as number[] : null;
  const lastState = (typeof markov === 'object' && markov !== null && 'lastState' in markov && typeof markov.lastState === 'number') ? markov.lastState as number : null;
  const ts = (typeof markov === 'object' && markov !== null && 'ts' in markov && typeof markov.ts === 'number') ? markov.ts : null;

  const nextData = next
    ? [{ name: 'Down', p: next[0] }, { name: 'Flat', p: next[1] }, { name: 'Up', p: next[2] }]
    : [{ name: 'Down', p: 0 }, { name: 'Flat', p: 0 }, { name: 'Up', p: 0 }];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Markov Transition Matrix</h2>
            <span className="text-xs text-gray-500">{ts !== null ? new Date(ts).toLocaleTimeString() : '—'}</span>
          </div>
          <div className="text-[11px] text-gray-500 mb-2 uppercase">From-state → To-state</div>
          <div className="overflow-x-auto">
            <table className="min-w-[260px] text-xs">
              <thead>
                <tr className="text-zinc-500">
                  <th className="text-left p-2">From \ To</th>
                  <th className="p-2">Down</th>
                  <th className="p-2">Flat</th>
                  <th className="p-2">Up</th>
                </tr>
              </thead>
              <tbody>
                {['Down','Flat','Up'].map((rowLabel, r) => (
                  <tr key={rowLabel} className="border-t border-zinc-800">
                    <td className="p-2 font-medium text-white">
                      {rowLabel}{lastState === r ? ' •' : ''}
                    </td>
                    {matrix[r].map((p: number, c: number) => (
                      <td key={c} className="p-0">
                        <div
                          className="text-center text-xs py-2"
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
          <div className="mt-2 text-xs text-gray-500">
            Last state: <span className="font-medium text-white">{lastState === null ? 'none' : ['Down','Flat','Up'][lastState]}</span>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Next-State Probabilities</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nextData} layout="vertical" margin={{ left: 24, right: 12, top: 8, bottom: 8 }}>
                <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${Math.round(v*100)}%`} tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <Tooltip formatter={(v:number) => `${(v*100).toFixed(2)}%`} />
                <Bar dataKey="p" unit="" fill="#34d399" radius={[4, 4, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {!next && <div className="text-xs text-gray-500 mt-2">Waiting for two ticks to form first transition…</div>}
        </div>
      </div>
    </div>
  );
}
