import { NextResponse } from 'next/server';
import { sessionStore } from '@/lib/server/sessionStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const snapshot = sessionStore.positionsSnapshot();
  return NextResponse.json(snapshot, { headers: { 'Cache-Control': 'no-store' } });
}
