import { NextRequest, NextResponse } from 'next/server';
import { readBridgeSettings, writeBridgeSettings } from '@/lib/server/bridgeSettings';

export const runtime = 'nodejs';

export async function GET() {
  const settings = await readBridgeSettings();
  return NextResponse.json(settings);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const updated = await writeBridgeSettings(body ?? {});
  return NextResponse.json(updated);
}

