import { NextRequest, NextResponse } from 'next/server';
import { bus } from '@/lib/engine/bus';
import { shadowSim } from '@/lib/engine/shadow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { orderId, px, qty } = await req.json().catch(() => ({})) as { orderId: string; px: number; qty: number };
  const ts = Date.now()/1000;
  bus.publish({ type: 'fill', payload: { orderId, ts, px, qty, kind: 'paper' } });
  const shadows = shadowSim.tryFills(ts);
  for (const f of shadows) {
    bus.publish({ type: 'fill', payload: { orderId: f.orderId, ts: f.ts, px: f.avgPx, qty: f.qty, kind: 'shadow' } });
  }
  return NextResponse.json({ ok: true });
}
