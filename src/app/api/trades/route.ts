import { NextRequest, NextResponse } from 'next/server';
import { sessionStore } from '@/lib/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : 200;
  const snapshot = sessionStore.fillsSnapshot(Number.isFinite(limit) && limit > 0 ? limit : 200);
  return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
}

