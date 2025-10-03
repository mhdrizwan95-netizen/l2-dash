import { NextResponse } from 'next/server';
import { recordCommand } from '@/lib/server/commandLog';

export const runtime = 'nodejs';

export async function POST() {
  try {
    await recordCommand('flatten_all');
  } catch {
    return NextResponse.json({ ok: false, error: 'filesystem-error' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
