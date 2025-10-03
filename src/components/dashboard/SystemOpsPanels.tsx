"use client";

import { useMemo, useState } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

type ServiceStatus = {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  uptime: number; // seconds
  version: string;
  lastHeartbeat: number;
  restartCount: number;
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleString();
}

function formatHeartbeatAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m ${seconds % 60}s`;
}

export function ServiceHealthPanel() {
  // Mock service data - would come from /health/services SSE
  const services: ServiceStatus[] = useMemo(() => [
    { name: 'Blotter', status: 'healthy', uptime: 86400 * 3, version: '1.2.3-sha456', lastHeartbeat: Date.now() - 2000, restartCount: 0 },
    { name: 'Algo', status: 'healthy', uptime: 86400 * 2, version: '2.1.0-sha789', lastHeartbeat: Date.now() - 1500, restartCount: 1 },
    { name: 'ML', status: 'warning', uptime: 86400 * 1, version: '0.8.1-sha101', lastHeartbeat: Date.now() - 8000, restartCount: 0 },
    { name: 'Broker', status: 'healthy', uptime: 86400 * 5, version: '1.5.2-sha202', lastHeartbeat: Date.now() - 3000, restartCount: 2 },
    { name: 'Reports', status: 'healthy', uptime: 86400 * 4, version: '3.0.1-sha303', lastHeartbeat: Date.now() - 1800, restartCount: 0 },
  ], []);

  const unhealthyCount = services.filter(s => s.status !== 'healthy').length;
  const totalHeartbeatAge = services.reduce((sum, s) => sum + (Date.now() - s.lastHeartbeat), 0) / services.length;

  return (
    <Card title="Service Health">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-center">
            <div className="text-sm font-semibold">{services.filter(s => s.status === 'healthy').length}/{services.length}</div>
            <div className="text-zinc-400">Healthy</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold" style={{ color: unhealthyCount > 0 ? '#f87171' : '#34d399' }}>
              {unhealthyCount}
            </div>
            <div className="text-zinc-400">Issues</div>
          </div>
        </div>

        <div className="space-y-2 max-h-32 overflow-y-auto">
          {services.map(service => (
            <div key={service.name} className="flex items-center justify-between py-1 px-2 rounded bg-[#10131d] text-xs">
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    service.status === 'healthy' ? 'bg-emerald-400' :
                    service.status === 'warning' ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                />
                <span className="font-medium">{service.name}</span>
              </div>
              <div className="text-zinc-400">{formatHeartbeatAge(Date.now() - service.lastHeartbeat)}</div>
            </div>
          ))}
        </div>

        <button className="w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-200 border border-zinc-700 bg-[#10131d] rounded hover:bg-zinc-800">
          View Service Logs
        </button>
      </div>
    </Card>
  );
}

export function ClockDriftPanel() {
  const driftMs = useMemo(() => Math.random() * 20 - 10, []); // Mock drift between -10ms to +10ms
  const isHighDrift = Math.abs(driftMs) > 10;

  return (
    <Card title="Clock Drift">
      <div className="space-y-3">
        <div className="text-center">
          <div className="text-lg font-semibold mb-1" style={{ color: isHighDrift ? '#f87171' : Math.abs(driftMs) > 5 ? '#fbbf24' : '#34d399' }}>
            {driftMs > 0 ? '+' : ''}{driftMs.toFixed(1)}ms
          </div>
          <div className="text-xs text-zinc-400">vs NTP/exchange</div>
          {isHighDrift && (
            <div className="text-xs text-rose-300 mt-2">⚠️ High drift detected</div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-400">NTP sync</span>
            <span className="text-emerald-300">OK</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-400">Exchange clock</span>
            <span className="text-emerald-300">OK</span>
          </div>
        </div>

        <button className="w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-200 border border-zinc-700 bg-[#10131d] rounded hover:bg-zinc-800">
          NTP Sync Now
        </button>
      </div>
    </Card>
  );
}

export function ResourceUsagePanel() {
  // Mock resource data
  const resources = useMemo(() => ({
    cpu: 45,
    memory: 62,
    diskIo: 28,
    network: 15,
    cpuHistory: [40, 45, 48, 42, 50, 45],
    memHistory: [58, 62, 65, 60, 67, 62],
    ioHistory: [25, 28, 32, 24, 30, 28],
    netHistory: [12, 15, 18, 14, 16, 15],
  }), []);

  const isOverThreshold = (value: number, type: string) => {
    switch (type) {
      case 'cpu': return value > 80;
      case 'memory': return value > 85;
      case 'diskIo': return value > 90;
      case 'network': return value > 70;
      default: return false;
    }
  };

  const getColor = (value: number, threshold: number) => {
    if (value > threshold) return 'text-rose-300';
    if (value > threshold * 0.8) return 'text-amber-300';
    return 'text-emerald-300';
  };

  return (
    <Card title="Resource Usage">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-xl font-semibold mb-1" style={{ color: getColor(resources.cpu, 80) }}>
              {resources.cpu}%
            </div>
            <div className="text-xs text-zinc-400">CPU</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold mb-1" style={{ color: getColor(resources.memory, 85) }}>
              {resources.memory}%
            </div>
            <div className="text-xs text-zinc-400">Memory</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold mb-1" style={{ color: getColor(resources.diskIo, 90) }}>
              {resources.diskIo}%
            </div>
            <div className="text-xs text-zinc-400">Disk IO</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-semibold mb-1" style={{ color: getColor(resources.network, 70) }}>
              {resources.network}%
            </div>
            <div className="text-xs text-zinc-400">Network</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-zinc-400 mb-2">Last 30 seconds (5s intervals)</div>
          {['cpu', 'memory', 'diskIo', 'network'].map(type => {
            const current = resources[type as keyof typeof resources] as number;
            const values = resources[`${type}History` as keyof typeof resources] as number[];
            return (
              <div key={type} className="space-y-1">
                <div className="text-xs text-zinc-500 capitalize">{type}</div>
                <div className="flex gap-1">
                  {values.map((val, i) => (
                    <div
                      key={i}
                      className="bg-cyan-600 rounded-sm flex-1 transition-all duration-200"
                      style={{
                        height: `${Math.max(8, (val / 100) * 20)}px`,
                        opacity: i === values.length - 1 ? 1 : 0.6
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export function ContainersPanel() {
  const containers = useMemo(() => [
    { name: 'blotter-service', status: 'running', restarts: 2, uptime: 86400 * 2 + 3600 * 3, healthProbes: 'OK' },
    { name: 'algo-service', status: 'running', restarts: 1, uptime: 86400 * 2, healthProbes: 'OK' },
    { name: 'ml-inference', status: 'running', restarts: 0, uptime: 86400 * 2 + 3600 * 5, healthProbes: 'OK' },
    { name: 'broker-proxy', status: 'restarting', restarts: 3, uptime: 3600 * 4, healthProbes: 'FAIL' },
    { name: 'reports-db', status: 'running', restarts: 5, uptime: 86400 * 30, healthProbes: 'OK' },
  ], []);

  return (
    <Card title="Containers & Processes">
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {containers.map(container => (
          <div key={container.name} className="grid grid-cols-12 gap-2 text-xs py-2 border-b border-zinc-800 last:border-b-0">
            <div className="col-span-4">
              <div className="font-medium">{container.name}</div>
              <div className="text-zinc-400 text-[10px]">{formatUptime(container.uptime)}</div>
            </div>
            <div className="col-span-2">
              <div className={`text-center px-1 py-0.5 rounded text-[10px] font-semibold uppercase ${
                container.status === 'running' ? 'bg-emerald-500/20 text-emerald-300' :
                container.status === 'restarting' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {container.status}
              </div>
            </div>
            <div className="col-span-2 text-center text-zinc-300">{container.restarts}</div>
            <div className="col-span-2 text-center text-zinc-300">{container.healthProbes}</div>
            <div className="col-span-2 text-center">
              <button className="px-1 py-0.5 text-[10px] rounded border border-zinc-600 text-zinc-400 hover:bg-zinc-800">
                Mute
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function BackupStatusPanel() {
  const [backingUp, setBackingUp] = useState(false);

  const backups = useMemo(() => [
    {
      type: 'Models',
      lastBackup: Date.now() - 3600000 * 2, // 2 hours ago
      size: '2.5GB',
      destination: 'AWS S3',
      success: true,
      details: 'Includes all trained models and metadata'
    },
    {
      type: 'Logs',
      lastBackup: Date.now() - 3600000 * 6, // 6 hours ago
      size: '8.3GB',
      destination: 'AWS S3',
      success: true,
      details: 'Trade logs, system events, performance data'
    }
  ], []);

  const handleSnapshot = async () => {
    setBackingUp(true);
    // Simulate backup process
    await new Promise(resolve => setTimeout(resolve, 3000));
    setBackingUp(false);
  };

  return (
    <Card title="Backup Status">
      <div className="space-y-3">
        {backups.map(backup => (
          <div key={backup.type} className="border border-zinc-800 rounded p-3 bg-[#10131d] space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium text-sm">{backup.type}</div>
                <div className="text-xs text-zinc-400">{formatTimestamp(backup.lastBackup)}</div>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-semibold ${
                backup.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {backup.success ? 'SUCCESS' : 'FAILED'}
              </div>
            </div>
            <div className="text-xs text-zinc-300 space-y-1">
              <div>Size: {backup.size}</div>
              <div>Dst: {backup.destination}</div>
            </div>
          </div>
        ))}

        <button
          onClick={handleSnapshot}
          disabled={backingUp}
          className="w-full px-3 py-2 text-sm font-semibold uppercase tracking-wide text-zinc-200 border border-emerald-400/40 bg-emerald-500/10 rounded hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {backingUp ? 'Creating Snapshot…' : 'Snapshot Now'}
        </button>
      </div>
    </Card>
  );
}

export function GuardrailConfigPanel() {
  const [settings, setSettings] = useState({
    spreadCap: [6.0],
    maxPosition: [1000000],
    coolDown: [5],
    latencyLimit: [100],
    maxDrawdown: [2.5]
  });

  const [hasChanges, setHasChanges] = useState(false);

  const handleSliderChange = (key: keyof typeof settings, value: number[]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleRevert = () => {
    // Would revert to last saved config
    setHasChanges(false);
  };

  const handleSave = () => {
    // Would save to config service
    setHasChanges(false);
  };

  const sliderRanges = {
    spreadCap: { min: 0.5, max: 20, step: 0.1 },
    maxPosition: { min: 10000, max: 5000000, step: 10000 },
    coolDown: { min: 1, max: 60, step: 1 },
    latencyLimit: { min: 10, max: 1000, step: 10 },
    maxDrawdown: { min: 0.5, max: 10, step: 0.1 }
  };

  return (
    <Card title="Guardrail Config">
      <div className="space-y-4">
        {Object.entries(settings).map(([key, value]) => {
          const range = sliderRanges[key as keyof typeof sliderRanges];
          const label = key.replace(/([A-Z])/g, ' $1').toLowerCase();
          const suffix = key.includes('spread') || key.includes('drawdown') ? '%' :
                        key.includes('position') ? '$' :
                        key.includes('latency') ? 'ms' : 's';

          return (
            <div key={key} className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs text-zinc-400 capitalize">{label}:</label>
                <span className="text-xs text-zinc-300 font-mono">
                  {key.includes('position') ? value[0].toLocaleString() : value[0]}{suffix}
                </span>
              </div>
              <div className="px-1">
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  value={value[0]}
                  onChange={(e) => handleSliderChange(key as keyof typeof settings, [parseFloat(e.target.value)])}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                  <span>{range.min}{suffix}</span>
                  <span>{range.max}{suffix}</span>
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-200 border border-emerald-400/40 bg-emerald-500/10 rounded hover:bg-emerald-500/20 disabled:opacity-50 disabled:border-zinc-700 disabled:bg-[#10131d]"
          >
            Apply
          </button>
          <button
            onClick={handleRevert}
            disabled={!hasChanges}
            className="flex-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-200 border border-zinc-700 bg-[#10131d] rounded hover:bg-zinc-800 disabled:opacity-50"
          >
            Revert
          </button>
        </div>
      </div>
    </Card>
  );
}

export function DataStreamMonitorPanel() {
  const ticks = useTelemetryStore((state) => state.ticks);
  const lastTickAt = useTelemetryStore((state) => state.lastTickAt);
  const [symbolFilter, setSymbolFilter] = useState('AAPL');

  // Mock recent ticks for the selected symbol
  const recentTicks = useMemo(() => {
    const now = Date.now();
    return Array.from({ length: 5 }, (_, i) => ({
      symbol: symbolFilter,
      price: Math.round((150 + Math.random() * 10) * 100) / 100,
      ts: now - i * 2000,
      volume: Math.floor(Math.random() * 1000) + 100
    }));
  }, [symbolFilter]);

  const reconnectCount = 2; // Mock
  const streamHealth = lastTickAt && (Date.now() - lastTickAt) < 5000 ? 'healthy' : 'stale';

  return (
    <Card title="Data Stream Monitor">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-xs text-zinc-400">Symbol</label>
          <select
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            className="px-2 py-1 text-xs text-zinc-200 bg-[#10131d] border border-zinc-700 rounded focus:border-cyan-400 focus:outline-none"
          >
            {Object.keys(ticks).map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
            <option value="AAPL">AAPL</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div>
            <div className={`text-sm font-semibold ${streamHealth === 'healthy' ? 'text-emerald-300' : 'text-amber-300'}`}>
              {streamHealth === 'healthy' ? 'Streaming' : 'Stale'}
            </div>
            <div className="text-zinc-400">Status</div>
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-300">{reconnectCount}</div>
            <div className="text-zinc-400">Reconnects</div>
          </div>
        </div>

        <div className="border border-zinc-800 rounded bg-[#10131d] p-2">
          <div className="text-xs text-zinc-400 mb-2">Recent Ticks</div>
          <div className="space-y-1 text-[10px] max-h-24 overflow-y-auto">
            {recentTicks.map((tick, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-zinc-300">{tick.symbol}</span>
                <span className="text-zinc-300">${tick.price.toFixed(2)}</span>
                <span className="text-zinc-400">{new Date(tick.ts).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
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
