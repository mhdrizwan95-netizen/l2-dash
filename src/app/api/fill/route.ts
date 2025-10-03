import { NextRequest, NextResponse } from 'next/server';
import { bus } from '@/lib/bus';
import { shadowSim } from '@/lib/engine/shadow';
import { sessionStore } from '@/lib/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { orderId, px, qty, symbol, kind } = await req.json().catch(() => ({})) as {
    orderId?: string;
    px?: number;
    qty?: number;
    symbol?: string;
    kind?: string;
  };
  if (!orderId || typeof px !== 'number' || typeof qty !== 'number' || !symbol) {
    return NextResponse.json({ ok: false, error: 'bad-payload' }, { status: 400 });
  }
  const now = Date.now();
  const fillPayload = { orderId, ts: now, px, qty, symbol, kind: kind ?? 'paper' };
  sessionStore.recordFill(fillPayload);
  bus.publish({ type: 'fill', payload: fillPayload });
  const shadows = shadowSim.tryFills(now / 1000);
  for (const f of shadows) {
    const shadowFill = { orderId: f.orderId, ts: f.ts * 1000, px: f.avgPx, qty: f.qty, symbol, kind: 'shadow' };
    sessionStore.recordFill(shadowFill);
    bus.publish({ type: 'fill', payload: shadowFill });
  }
  return NextResponse.json({ ok: true });
}
