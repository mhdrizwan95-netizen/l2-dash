
import { NextResponse } from 'next/server';
import { loadStrategies } from '../../../../strategies/loader';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const strategies = await loadStrategies();
    // Only return id, name, schema, defaults for UI
    const items = strategies.map((s: any) => ({
      id: s.id,
      name: s.name,
      schema: s.ui?.schema,
      defaults: s.ui?.defaults,
    }));
    items.sort((a: { name: string }, b: { name: string }) => String(a.name).localeCompare(String(b.name)));
    return NextResponse.json({ strategies: items });
  } catch (e) {
    console.error('[strategies] error', e);
    return NextResponse.json({ strategies: [] });
  }
}

