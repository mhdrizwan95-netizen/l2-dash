import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const STATE_PATH = path.join(process.cwd(), 'sessions', 'universe-state.json');

async function readState() {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf-8');
    if (!raw.trim()) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET() {
  const state = await readState();
  if (!state) {
    return NextResponse.json({
      ts: null,
      todayTop10: [],
      activeSymbols: [],
      intersection: [],
      readyModels: [],
      readyCount: 0,
      nextRefreshTs: null,
      nextChurnTs: null,
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}

export const runtime = 'nodejs';
