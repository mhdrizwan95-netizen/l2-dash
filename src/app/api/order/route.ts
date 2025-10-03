import { NextRequest, NextResponse } from 'next/server';
import { bus } from '@/lib/bus';
import { shadowSim } from '@/lib/engine/shadow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { side, qty, type, price } = await req.json().catch(() => ({})) as
    { side: 'BUY'|'SELL'; qty: number; type: 'MKT'|'LMT'; price?: number };
  const id = crypto.randomUUID();
  bus.publish({ type: 'control', payload: { kind: 'order_accept', id, side, qty, type, price, ts: Date.now()/1000 } });
  if (type === 'LMT' && typeof price === 'number') {
    shadowSim.placeLimit({ id, side, price, qty, ts: Date.now()/1000 });
  }
  return NextResponse.json({ ok: true, id });
}
