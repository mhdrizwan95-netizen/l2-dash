import { NextRequest } from 'next/server';
import { bus } from '@/lib/bus';
import { markovBySymbol } from '@/lib/markov';
import '@/lib/guardrails';
import { sessionStore } from '@/lib/server/sessionStore';
import { readBridgeSettings } from '@/lib/server/bridgeSettings';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const settings = await readBridgeSettings();
  const expectedKey = settings.ingestKey || '';
  const key = req.headers.get('x-ingest-key') || '';
  if (expectedKey && key !== expectedKey) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.symbol !== 'string' || typeof body.price !== 'number') {
    return Response.json({ ok: false, error: 'bad-payload' }, { status: 400 });
  }

  const { symbol, price, ts = Date.now() } = body as { symbol: string; price: number; ts?: number };
  bus.publish({ type: 'tick', payload: { symbol, price, ts } });
  sessionStore.recordTick({ symbol, price, ts });

  const mk = markovBySymbol(symbol);
  const prev = typeof mk.lastPrice === 'number' ? mk.lastPrice : price;
  mk.observe(prev, price);
  mk.lastPrice = price;
  mk.maybePublish();

  return Response.json({ ok: true });
}
