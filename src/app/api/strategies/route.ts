
import { NextResponse } from 'next/server';
import { loadStrategies } from '../../../../strategies/loader';

type UiSchemaEntry = Record<string, unknown>;

type LoadedStrategy = {
  id: string;
  name?: string;
  ui?: {
    schema?: unknown;
    defaults?: Record<string, unknown>;
  };
};

function normalizeSchema(schema: unknown): UiSchemaEntry[] {
  if (!schema) return [];
  if (Array.isArray(schema)) {
    return schema.filter((item): item is UiSchemaEntry => Boolean(item) && typeof item === 'object');
  }
  if (typeof schema === 'object') {
    const entries = schema as Record<string, unknown>;
    return Object.entries(entries).map(([key, definition]) => ({
      key,
      ...(definition && typeof definition === 'object' ? (definition as UiSchemaEntry) : {}),
    }));
  }
  return [];
}

export const runtime = 'nodejs';

export async function GET() {
  try {
    const strategies = (await loadStrategies()) as LoadedStrategy[];
    const items = strategies
      .filter((strategy) => typeof strategy.id === 'string')
      .map((strategy) => ({
        id: strategy.id,
        name: typeof strategy.name === 'string' ? strategy.name : strategy.id,
        schema: normalizeSchema(strategy.ui?.schema),
        defaults: strategy.ui?.defaults ?? {},
      }));
    items.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return NextResponse.json({ strategies: items });
  } catch (e) {
    console.error('[strategies] error', e);
    return NextResponse.json({ strategies: [] });
  }
}
