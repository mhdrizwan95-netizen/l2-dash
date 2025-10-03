import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const status = {
    ml: { ok: false },
    timestamp: Date.now(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const res = await fetch('http://127.0.0.1:8000/health', {
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    status.ml.ok = res.ok;
  } catch {
    status.ml.ok = false;
  }

  return NextResponse.json(status);
}
