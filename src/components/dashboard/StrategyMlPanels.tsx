'use client';

import { useMemo } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';
import { GuardrailFeed } from '../GuardrailFeed';

function useMarkovSnapshot(): Record<string, unknown> | null {
  const raw = useTelemetryStore((state) => state.markov);
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).map((entry) => (typeof entry === 'number' ? entry : 0));
}

function toNumberMatrix(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).map((row) => toNumberArray(row));
}

function formatTimestamp(value: unknown): string {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(numeric) ? new Date(numeric).toLocaleTimeString() : '—';
}

function formatDateTime(value: unknown): string {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : Number.NaN;
  return Number.isFinite(numeric) ? new Date(numeric).toLocaleString() : '—';
}

export function ActiveModelInfoPanel() {
  const markov = useMarkovSnapshot();

  const rows = useMemo(() => {
    if (!markov) return [];
    const counts = toNumberArray(markov.counts);
    const totalTransitions = counts.reduce((acc, value) => acc + (value ?? 0), 0);
    return [
      { label: 'Symbol', value: typeof markov.symbol === 'string' ? markov.symbol : '—' },
      { label: 'Snapshots recorded', value: `${totalTransitions}` },
      { label: 'States', value: `${Array.isArray(markov.P) ? (markov.P as unknown[]).length : 0}` },
      { label: 'Last update', value: formatTimestamp(markov.ts) },
    ];
  }, [markov]);

  return (
    <Card title="Active Model">
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Awaiting Markov telemetry. Once the HMM service begins publishing `/infer` results, model metadata will populate here.
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2">
              <span className="text-zinc-400">{row.label}</span>
              <span className="text-white">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function CurrentStatePanel() {
  const markov = useMarkovSnapshot();
  const probs = toNumberArray(markov?.next);
  const stateLabels = ['State 0', 'State 1', 'State 2'];
  const currentState = typeof markov?.lastState === 'number' ? markov.lastState : null;

  return (
    <Card title="Current State">
      {!probs.length ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          State probabilities appear after the algo requests `/infer` from the HMM service.
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="text-lg font-semibold text-white">
            {currentState !== null ? `State ${currentState}` : '—'}
          </div>
          <div className="space-y-2">
            {probs.map((p, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{stateLabels[idx] ?? `State ${idx}`}</span>
                  <span>{(p * 100).toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800">
                  <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.min(100, Math.max(0, p * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export function StatePnlMatrixPanel() {
  const markov = useMarkovSnapshot();
  const matrix = toNumberMatrix(markov?.P);

  return (
    <Card title="Transition Probabilities">
      {!matrix.length ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Transition statistics populate once the Markov process has observed enough ticks.
        </div>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">From → To</th>
                {matrix[0].map((_to, idx) => (
                  <th key={idx} className="px-4 py-2 text-left font-medium">State {idx}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-200">
              {matrix.map((row, fromIdx) => (
                <tr key={fromIdx}>
                  <td className="px-4 py-2 font-medium text-white">State {fromIdx}</td>
                  {row.map((value, toIdx) => (
                    <td key={toIdx} className="px-4 py-2">{(value * 100).toFixed(1)}%</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function GuardrailLogPanel() {
  return (
    <Card title="Guardrail Log">
      <div className="max-h-64 overflow-auto">
        <GuardrailFeed limit={12} />
      </div>
    </Card>
  );
}

export function DriftMonitorPanel() {
  const markov = useTelemetryStore((state) => state.markov);

  const occupancy = useMemo(() => {
    if (typeof markov !== 'object' || markov === null || !('counts' in markov) || !Array.isArray(markov.counts)) return [];
    const counts = markov.counts as number[];
    const perState = [0, 0, 0];
    counts.forEach((value, idx) => {
      perState[Math.floor(idx / 3)] += value ?? 0;
    });
    const total = perState.reduce((acc, value) => acc + value, 0);
    if (total === 0) return perState.map(() => 0);
    return perState.map((value) => value / total);
  }, [markov]);

  return (
    <Card title="State Occupancy">
      {!occupancy.length ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Occupancy metrics become available after a few dozen transitions.
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {occupancy.map((weight, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2">
              <span className="text-zinc-400">State {idx}</span>
              <span className="text-white">{(weight * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function OnlineUpdatesPanel() {
  const ticks = useTelemetryStore((state) => state.ticks);
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const fills = useTelemetryStore((state) => state.fills);

  const stats = useMemo(() => {
    const symbolCount = Object.keys(ticks).length;
    const tickSamples = Object.values(ticks).reduce((acc, entry) => acc + entry.history.length, 0);
    return [
      { label: 'Symbols streaming', value: `${symbolCount}` },
      { label: 'Tick samples buffered', value: `${tickSamples}` },
      { label: 'Fills processed', value: `${fills.length}` },
      { label: 'Guardrail alerts', value: `${guardrails.length}` },
    ];
  }, [fills.length, guardrails.length, ticks]);

  return (
    <Card title="Live Telemetry">
      {stats.every((item) => item.value === '0') ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Waiting on the first batch of live data. Verify the blotter feed and the Algo service are running.
        </div>
      ) : (
        <div className="grid gap-2 text-sm">
          {stats.map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#10131d] px-3 py-2">
              <span className="text-zinc-400">{row.label}</span>
              <span className="text-white">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function TrainingMetricsPanel() {
  return (
    <Card title="Training Metrics">
      <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
        Offline training metrics will surface once the ML service exposes `/train` and `/partial_fit` telemetry.
        Monitor `ml-service/main.py` for integration progress.
      </div>
    </Card>
  );
}

export function SuggestedVsExecutedPanel() {
  const suggestExecEntries = useTelemetryStore((state) => state.suggestExec);

  return (
    <Card title="Suggested vs Executed">
      {!suggestExecEntries.length ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Suggestion tracking will populate after the strategy service begins publishing `/exec/suggest_exec` events.
        </div>
      ) : (
        <div className="space-y-2 text-xs">
          {suggestExecEntries.slice(0, 10).map((entry, idx) => (
            <div key={idx} className="rounded-lg border border-zinc-800 bg-[#10131d] p-2">
              <div className="flex items-center justify-between text-zinc-400">
                <span>{formatTimestamp(entry.ts)}</span>
                <span className={`px-1 rounded text-xs ${entry.executed ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                  {entry.executed ? '✓' : '✗'}
                </span>
              </div>
              <div className="text-white mt-1">
                <strong>{entry.suggested}</strong>
                {entry.reason && (
                  <div className="text-zinc-400 text-xs mt-1">{entry.reason}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function FeatureHealthPanel() {
  const featureHealth = useTelemetryStore((state) => state.featureHealth);

  if (!featureHealth) {
    return (
      <Card title="Feature Health">
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Feature health monitoring will populate after the ML service begins publishing `/hmm/feature_health` events.
        </div>
      </Card>
    );
  }

  const hasIssues = featureHealth.nans > 0 || featureHealth.infs > 0 || featureHealth.out_of_range > 0 || !featureHealth.features_sha_ok || !featureHealth.scaler_loaded;

  return (
    <Card title="Feature Health">
      <div className="space-y-3">
        <div className="text-xs text-zinc-400 mb-2">Symbol: {featureHealth.symbol || '—'}</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">NaNs</span>
            <span className={`text-sm ${featureHealth.nans > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {featureHealth.nans}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Infs</span>
            <span className={`text-sm ${featureHealth.infs > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {featureHealth.infs}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Out-of-range</span>
            <span className={`text-sm ${featureHealth.out_of_range > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {featureHealth.out_of_range}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Feature hash match</span>
            <span className={`text-sm ${featureHealth.features_sha_ok ? 'text-green-400' : 'text-red-400'}`}>
              {featureHealth.features_sha_ok ? '✓' : '✗'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Scaler loaded</span>
            <span className={`text-sm ${featureHealth.scaler_loaded ? 'text-green-400' : 'text-red-400'}`}>
              {featureHealth.scaler_loaded ? '✓' : '✗'}
            </span>
          </div>
        </div>
        {hasIssues && (
          <div className="text-xs text-red-400 mt-2">
            ❌ Issues detected - /infer may be blocked
          </div>
        )}
      </div>
    </Card>
  );
}

export function ModelProvenancePanel() {
  const hmmMetrics = useTelemetryStore((state) => state.hmmMetrics);

  if (!hmmMetrics) {
    return (
      <Card title="Model Provenance">
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Provenance details will appear after the ML service publishes `/hmm/metrics` or artifact metadata.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Model Provenance">
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Version</span>
          <span className="text-white text-xs font-mono">{hmmMetrics.modelVersion || '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Converged</span>
          <span className={`text-xs ${hmmMetrics.converged ? 'text-green-400' : 'text-orange-400'}`}>
            {hmmMetrics.converged ? '✓ Converged' : '⚠ Unstable'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Iterations</span>
          <span className="text-white">{hmmMetrics.iters}</span>
        </div>
        {hmmMetrics.sharpe && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Sharpe</span>
            <span className="text-white">{hmmMetrics.sharpe.toFixed(2)}</span>
          </div>
        )}
        {hmmMetrics.hitrate && (
          <div className="flex items-center justify-between">
            <span className="text-zinc-400">Hit Rate</span>
            <span className="text-white">{(hmmMetrics.hitrate * 100).toFixed(1)}%</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Log Likelihood</span>
          <span className="text-white text-xs font-mono">{hmmMetrics.val_loglik.toFixed(3)}</span>
        </div>
      </div>
    </Card>
  );
}

export function PolicyMappingPanel() {
  const policyStatus = useTelemetryStore((state) => state.policyStatus);

  if (!policyStatus) {
    return (
      <Card title="Policy Mapping">
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Policy configuration will populate after `/policy/status` events are received.
        </div>
      </Card>
    );
  }

  return (
    <Card title="Policy Mapping">
      <div className="space-y-3">
        <div className="text-xs text-zinc-400 mb-2">State → Action</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Bullish States</span>
            <span className="text-white">{policyStatus.bullishStates.join(', ')}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Bearish States</span>
            <span className="text-white">{policyStatus.bearishStates.join(', ')}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Long Enter ≥</span>
            <span className="text-white">{policyStatus.longEnterProb.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Short Enter ≥</span>
            <span className="text-white">{policyStatus.shortEnterProb.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Min Confidence</span>
            <span className="text-white">{policyStatus.minConfidence.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function StateToPnlMatrixPanel() {
  // This should show per-state PnL metrics, but we don't have this data yet
  return (
    <Card title="State → PnL Matrix">
      <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
        Per-state PnL performance will populate after the strategy service publishes historical session data.
        Each state will show # trades, hit-rate %, avg PnL/trade, and Sharpe.
      </div>
    </Card>
  );
}

export function ActionTimelinePanel() {
  // Simple placeholder - in a real implementation this would be a chart
  const suggestExecEntries = useTelemetryStore((state) => state.suggestExec);

  if (!suggestExecEntries.length) {
    return (
      <Card title="Action Timeline">
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Action timeline chart will populate after suggestion tracking begins.
          Will show state changes (color), suggested actions (markers), executed fills (icons), and guardrail blocks (red ticks).
        </div>
      </Card>
    );
  }

  return (
    <Card title="Action Timeline">
      <div className="space-y-1 overflow-auto max-h-full">
        {suggestExecEntries.slice(-20).map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs border-l-2 border-zinc-600 pl-2">
            <span className="text-zinc-400">{formatTimestamp(entry.ts)}</span>
            <span className={`text-white ${entry.executed ? 'text-green-400' : 'text-red-400'}`}>
              {entry.suggested}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function EntropyTimelinePanel() {
  const hmmState = useTelemetryStore((state) => state.hmmState);

  if (!hmmState) {
    return (
      <Card title="Entropy Timeline">
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Entropy timeline will populate after `/hmm/state` events are received.
          Will show entropy vs time with Min Confidence threshold line.
        </div>
      </Card>
    );
  }

  const entropyBadge = hmmState.entropy <= 0.15 ? 'Low' : hmmState.entropy <= 0.3 ? 'Med' : 'High';
  const badgeColor = hmmState.entropy <= 0.15 ? 'text-green-400' : hmmState.entropy <= 0.3 ? 'text-yellow-400' : 'text-red-400';

  return (
    <Card title="Entropy Timeline">
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Current Entropy</span>
          <span className={`font-medium ${badgeColor}`}>{entropyBadge}: {hmmState.entropy.toFixed(3)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Confidence</span>
          <span className="text-white">{(hmmState.confidence * 100).toFixed(1)}%</span>
        </div>
        <div className="text-xs text-zinc-400">
          Threshold: amber when {'>'} 0.15, red when {'>'} 0.3
        </div>
      </div>
    </Card>
  );
}

export function InferenceLatencyPanel() {
  const mlLatency = useTelemetryStore((state) => state.mlLatency);

  if (!mlLatency) {
    return (
      <Card title="Inference Latency">
        <div className="rounded-lg border border-dashed border-zinc-700 bg-[#10131d] p-4 text-sm text-zinc-400">
          Inference latency charts will populate after the ML service publishes `/ml/latency` events.
        </div>
      </Card>
    );
  }

  const isHighLatency = mlLatency.p95 > 50; // assuming 50ms threshold - could be configurable

  return (
    <Card title="Inference Latency">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="text-center">
            <div className="text-zinc-400 text-xs">P50</div>
            <div className="text-white font-medium">{mlLatency.p50.toFixed(1)}ms</div>
          </div>
          <div className="text-center">
            <div className="text-zinc-400 text-xs">P95</div>
            <div className={`font-medium ${isHighLatency ? 'text-red-400' : 'text-white'}`}>
              {mlLatency.p95.toFixed(1)}ms
            </div>
          </div>
          <div className="text-center">
            <div className="text-zinc-400 text-xs">P99</div>
            <div className="text-white font-medium">{mlLatency.p99.toFixed(1)}ms</div>
          </div>
        </div>

        <div className="text-xs text-zinc-400">
          Histogram: {mlLatency.histogram.length} recent calls
        </div>

        {isHighLatency && (
          <div className="text-xs text-red-400 mt-2">
            ⚠️ High latency detected - investigate bottlenecks
          </div>
        )}
      </div>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</div>
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
