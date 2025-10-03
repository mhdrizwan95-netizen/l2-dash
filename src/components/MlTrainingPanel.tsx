'use client';

const jobs = [
  { id: 'hmm-eod', label: 'Daily HMM Refresh', status: 'Scheduled 02:00 ET', progress: 72 },
  { id: 'feature-drift', label: 'Feature Drift Scan', status: 'Queued', progress: 0 },
  { id: 'minibatch', label: 'Live Mini-batch Update', status: 'Idle', progress: 0 },
];

const datasets = [
  { label: 'Historical L2 Samples', value: '128M rows', detail: 'Aug 2023 → Sep 2025' },
  { label: 'Current Regime', value: 'State 4 (Bullish)', detail: 'Last change 09:45 ET' },
  { label: 'Validation Sharpe', value: '1.32', detail: 'Out-of-sample' },
];

export function MlTrainingPanel() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
        <h2 className="text-lg font-semibold text-white">Training Jobs</h2>
        <p className="text-sm text-zinc-500">Monitor queued and active ML jobs running on the research cluster.</p>

        <div className="mt-6 space-y-4">
          {jobs.map(job => (
            <div key={job.id} className="rounded-xl border border-zinc-800 bg-black/30 p-4">
              <div className="flex items-center justify-between text-sm text-zinc-300">
                <span className="font-medium text-white">{job.label}</span>
                <span className="text-xs uppercase tracking-wider text-zinc-500">{job.status}</span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-zinc-800">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.min(job.progress, 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {datasets.map(item => (
          <div key={item.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500">{item.label}</div>
            <div className="mt-2 text-xl font-semibold text-white">{item.value}</div>
            <div className="mt-1 text-xs text-zinc-500">{item.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
