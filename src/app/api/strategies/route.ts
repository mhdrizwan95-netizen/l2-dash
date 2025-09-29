import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const dir = path.join(process.cwd(), 'strategies');
    const files = await fs.readdir(dir);
    const items: any[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const raw = await fs.readFile(path.join(dir, f), 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.id && parsed.name && parsed.defaults && parsed.schema) {
        items.push(parsed);
      }
    }
    items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return NextResponse.json({ strategies: items });
  } catch (e) {
    console.error('[strategies] error', e);
    return NextResponse.json({ strategies: [] });
  }
}
