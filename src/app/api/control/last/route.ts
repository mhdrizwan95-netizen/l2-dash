import { NextResponse } from 'next/server';
import { getLastCommand } from '@/lib/server/controlState';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const last = await getLastCommand();
  return NextResponse.json({ last });
}
