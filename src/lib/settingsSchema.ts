export type BridgeSettings = {
  host: string;
  port: number;
  clientId: number;
  account?: string;
  ingestKey?: string;
  tradingEnabled: boolean;
};

export const defaultBridgeSettings: BridgeSettings = {
  host: '127.0.0.1',
  port: 7497,
  clientId: 42,
  account: '',
  ingestKey: '',
  tradingEnabled: true,
};

export function normalizeBridgeSettings(input: Partial<BridgeSettings> | null | undefined): BridgeSettings {
  const base = { ...defaultBridgeSettings };
  if (!input || typeof input !== 'object') {
    return base;
  }

  if (typeof input.host === 'string' && input.host.trim()) {
    base.host = input.host.trim();
  }
  if (typeof input.port === 'number' && Number.isFinite(input.port)) {
    base.port = Math.max(0, Math.trunc(input.port));
  }
  if (typeof input.clientId === 'number' && Number.isFinite(input.clientId)) {
    base.clientId = Math.max(0, Math.trunc(input.clientId));
  }
  if (typeof input.account === 'string') {
    base.account = input.account.trim();
  }
  if (typeof input.ingestKey === 'string') {
    base.ingestKey = input.ingestKey.trim();
  }
  if (typeof input.tradingEnabled === 'boolean') {
    base.tradingEnabled = input.tradingEnabled;
  }

  return base;
}

export function mergeBridgeSettings(current: BridgeSettings, patch: unknown): BridgeSettings {
  if (!patch || typeof patch !== 'object') {
    return current;
  }

  const next: BridgeSettings = { ...current };
  const record = patch as Record<string, unknown>;

  if (typeof record.host === 'string') {
    const value = record.host.trim();
    if (value) next.host = value;
  }
  if (typeof record.port === 'number' && Number.isFinite(record.port)) {
    next.port = Math.max(0, Math.trunc(record.port));
  }
  if (typeof record.clientId === 'number' && Number.isFinite(record.clientId)) {
    next.clientId = Math.max(0, Math.trunc(record.clientId));
  }
  if (typeof record.account === 'string') {
    next.account = record.account.trim();
  }
  if (typeof record.ingestKey === 'string') {
    next.ingestKey = record.ingestKey.trim();
  }
  if (typeof record.tradingEnabled === 'boolean') {
    next.tradingEnabled = record.tradingEnabled;
  }

  return next;
}
