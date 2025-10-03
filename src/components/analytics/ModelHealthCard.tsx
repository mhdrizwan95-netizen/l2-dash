'use client';

export function ModelHealthCard() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">Model Health</div>
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Model Health Metrics
      </div>
    </div>
  );
}
