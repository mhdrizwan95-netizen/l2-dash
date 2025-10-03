'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStrategyStore } from '@/lib/strategyStore';
import { useTelemetryStore } from '@/lib/telemetryStore';

export function IbkrSettingsPanel() {
  const { settings, setSettings } = useStrategyStore();
  const [draft, setDraft] = useState(() => ({ ...settings }));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const bridgeStatus = useTelemetryStore((state) => state.bridgeStatus);
  const lastTickAt = useTelemetryStore((state) => state.lastTickAt);
  const positions = useTelemetryStore((state) => state.positions);

  useEffect(() => {
    setDraft({ ...settings });
  }, [settings]);

  const update = (key: keyof typeof draft, value: string | number | boolean) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const save = () => {
    setSettings(draft);
    setSavedAt(Date.now());
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Gateway Connection</h2>
            <p className="text-sm text-zinc-500">Configure the paper/live IBKR gateway credentials used by the bridge.</p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-300">
            {savedAt ? `Last saved ${new Date(savedAt).toLocaleTimeString()}` : 'Unsaved changes'}
          </span>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm text-zinc-400">
            Host
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white"
              value={draft.host}
              onChange={e => update('host', e.target.value)}
            />
          </label>
          <label className="text-sm text-zinc-400">
            Port
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white"
              type="number"
              value={draft.port}
              onChange={e => update('port', Number(e.target.value) || 0)}
            />
          </label>
          <label className="text-sm text-zinc-400">
            Client ID
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white"
              type="number"
              value={draft.clientId}
              onChange={e => update('clientId', Number(e.target.value) || 0)}
            />
          </label>
          <label className="flex items-center gap-3 text-sm text-zinc-400">
            <span>Trading Enabled</span>
            <input
              type="checkbox"
              checked={draft.tradingEnabled}
              onChange={e => update('tradingEnabled', e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
          </label>
          <label className="text-sm text-zinc-400">
            Account Code
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white"
              value={draft.account ?? ''}
              onChange={e => update('account', e.target.value)}
            />
          </label>
          <label className="md:col-span-2 text-sm text-zinc-400">
            Ingest Secret
            <input
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 p-2 text-white"
              value={draft.ingestKey ?? ''}
              placeholder="Shared secret between bridge -> /api/ingest"
              onChange={e => update('ingestKey', e.target.value)}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setDraft({ ...settings })}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Reset
          </button>
          <button
            onClick={save}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Save Settings
          </button>
        </div>
      </div>

      <StatusStrip
        bridgeStatus={bridgeStatus}
        lastTickAt={lastTickAt}
        account={draft.account}
        positions={positions}
        tradingEnabled={draft.tradingEnabled}
      />
    </div>
  );
}

function StatusStrip({
  bridgeStatus,
  lastTickAt,
  account,
  positions,
  tradingEnabled,
}: {
  bridgeStatus: 'connected' | 'disconnected';
  lastTickAt: number | null;
  account?: string;
  positions: Record<string, { qty: number }>;
  tradingEnabled: boolean;
}) {
  const heartbeat = useMemo(() => {
    if (!lastTickAt) return '—';
    const seconds = Math.max(0, (Date.now() - lastTickAt) / 1000);
    return `${seconds.toFixed(1)}s ago`;
  }, [lastTickAt]);

  const activeSymbols = useMemo(() => Object.keys(positions).length, [positions]);

  const items = [
    {
      label: 'Bridge Status',
      value: bridgeStatus === 'connected' ? 'Connected' : 'Disconnected',
      tone: bridgeStatus === 'connected' ? 'text-emerald-300' : 'text-rose-300',
    },
    {
      label: 'Trading Mode',
      value: tradingEnabled ? 'Active' : 'Paused',
      tone: tradingEnabled ? 'text-emerald-300' : 'text-amber-300',
    },
    {
      label: 'Last Heartbeat',
      value: heartbeat,
      tone: 'text-sky-300',
    },
    {
      label: 'Paper Account',
      value: account || 'Not set',
      tone: account ? 'text-white' : 'text-zinc-300',
    },
    {
      label: 'Active Symbols',
      value: activeSymbols.toString(),
      tone: 'text-white',
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((info) => (
        <div key={info.label} className="rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
          <div className="text-xs uppercase tracking-widest text-zinc-500">{info.label}</div>
          <div className={`mt-2 text-lg font-semibold ${info.tone}`}>{info.value}</div>
        </div>
      ))}
    </div>
  );
}
