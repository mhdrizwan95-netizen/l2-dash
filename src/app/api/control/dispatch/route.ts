import { NextRequest, NextResponse } from 'next/server';
import { bus } from '@/lib/bus';
import type { ControlCommand, ControlCommandKind } from '@/lib/controlTypes';
import { recordCommand } from '@/lib/server/commandLog';
import { writeBridgeSettings } from '@/lib/server/bridgeSettings';
import { setLastCommand } from '@/lib/server/controlState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_KINDS: ControlCommandKind[] = [
  'set_trading_mode',
  'kill_switch',
  'flatten_all',
  'rebuild_universe',
  'heartbeat',
];

function isValidKind(kind: unknown): kind is ControlCommandKind {
  return typeof kind === 'string' && VALID_KINDS.includes(kind as ControlCommandKind);
}

function coerceBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'bad-payload' }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const kind = record.kind;
  if (!isValidKind(kind)) {
    return NextResponse.json({ ok: false, error: 'unsupported-command' }, { status: 400 });
  }

  const payloadRaw = typeof record.payload === 'object' && record.payload !== null
    ? (record.payload as Record<string, unknown>)
    : undefined;
  const source = typeof record.source === 'string' ? record.source : 'ws';

  const timestamp = typeof record.ts === 'number' && Number.isFinite(record.ts)
    ? record.ts
    : Date.now();

  let normalizedPayload: Record<string, unknown> | undefined;

  switch (kind) {
    case 'set_trading_mode': {
      const enabled = coerceBoolean(payloadRaw?.enabled);
      if (enabled === null) {
        return NextResponse.json({ ok: false, error: 'missing-enabled' }, { status: 400 });
      }
      normalizedPayload = { enabled };
      await writeBridgeSettings({ tradingEnabled: enabled });
      break;
    }
    case 'kill_switch': {
      normalizedPayload = { enabled: false };
      await writeBridgeSettings({ tradingEnabled: false });
      await recordCommand('kill_switch');
      break;
    }
    case 'flatten_all': {
      normalizedPayload = {};
      await recordCommand('flatten_all');
      break;
    }
    case 'rebuild_universe': {
      normalizedPayload = {};
      await recordCommand('rebuild_universe');
      break;
    }
    case 'heartbeat': {
      normalizedPayload = payloadRaw;
      break;
    }
    default:
      normalizedPayload = payloadRaw;
  }

  const command: ControlCommand = {
    kind,
    ts: timestamp,
    payload: normalizedPayload,
    source,
  };

  await setLastCommand(command);
  bus.publish({ type: 'control', payload: command });

  return NextResponse.json({ ok: true, command });
}
