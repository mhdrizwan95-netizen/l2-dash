import { NextRequest } from 'next/server';
import { bus } from '@/lib/bus';
import { readBridgeSettings } from '@/lib/server/bridgeSettings';
import { sessionStore, type AccountSnapshot } from '@/lib/server/sessionStore';

export const runtime = 'nodejs';

function coerceNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export async function POST(req: NextRequest) {
  const settings = await readBridgeSettings();
  const expectedKey = settings.ingestKey || '';
  const key = req.headers.get('x-ingest-key') || '';
  if (expectedKey && key !== expectedKey) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return Response.json({ ok: false, error: 'bad-payload' }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const snapshot: AccountSnapshot = {
    ts: Date.now(),
    cash: coerceNumber(record.cash),
    availableFunds: coerceNumber(record.availableFunds),
    buyingPower: coerceNumber(record.buyingPower),
    marginUsed: coerceNumber(record.marginUsed),
    netLiquidation: coerceNumber(record.netLiquidation),
    equityWithLoan: coerceNumber(record.equityWithLoan),
  };

  sessionStore.recordAccount(snapshot);
  bus.publish({ type: 'account', payload: snapshot });

  return Response.json({ ok: true });
}
