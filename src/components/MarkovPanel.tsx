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
  // TODO: Connect to actual markov data when available
  // const markov = useTelemetryStore((state) => state.markov);

  // Mock data for now
  const matrix = [[0.3, 0.4, 0.3], [0.2, 0.5, 0.3], [0.1, 0.3, 0.6]];
  const next = [0.2, 0.4, 0.4];
  const lastState = 1;
  const ts = Date.now();

  const nextData = next
    ? [{ name: 'Down', p: next[0] }, { name: 'Flat', p: next[1] }, { name: 'Up', p: next[2] }]
    : [{ name: 'Down', p: 0 }, { name: 'Flat', p: 0 }, { name: 'Up', p: 0 }];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 h-full overflow-hidden">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Markov Transition Matrix</h2>
        <span className="text-xs text-gray-500">{ts !== null ? new Date(ts).toLocaleTimeString() : '—'}</span>
      </div>
      <div className="text-[11px] text-gray-500 mb-2 uppercase">From-state → To-state</div>
      <div className="overflow-x-auto h-full">
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
  );
}
