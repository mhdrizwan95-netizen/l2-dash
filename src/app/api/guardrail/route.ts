import { NextRequest, NextResponse } from 'next/server';
import { bus } from '@/lib/bus';
import { sessionStore } from '@/lib/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toTimestamp(input: unknown): number {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const parsed = Date.parse(input);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.rule !== 'string') {
    return NextResponse.json({ ok: false, error: 'bad-payload' }, { status: 400 });
  }

  const rule = body.rule as string;
  const message = typeof body.message === 'string' ? body.message : '';
  const symbol = typeof body.symbol === 'string' ? body.symbol : undefined;
  const severity = body.severity === 'block' || body.severity === 'info' ? body.severity : 'warn';
  const ts = toTimestamp(body.ts);

  const event = { rule, message, symbol, ts, severity };
  sessionStore.recordGuardrail(event);
  bus.publish({ type: 'guardrail', payload: event });

  return NextResponse.json({ ok: true });
}

