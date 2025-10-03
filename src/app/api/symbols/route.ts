import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SYMBOLS_PATH = path.join(process.cwd(), 'sessions', 'active-symbols.json');

type SymbolRecord = {
  symbol: string;
  exchange?: string;
  currency?: string;
  secType?: string;
  primaryExchange?: string;
};

async function readSymbols(): Promise<SymbolRecord[]> {
  try {
    const raw = await fs.readFile(SYMBOLS_PATH, 'utf-8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed) ? parsed : parsed?.symbols;
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        if (typeof item === 'string') {
          return { symbol: item.toUpperCase() } satisfies SymbolRecord;
        }
        if (item && typeof item === 'object') {
          const symbol = String(item.symbol || '').toUpperCase();
          if (!symbol) return null;
          return {
            symbol,
            exchange: item.exchange,
            currency: item.currency,
            secType: item.secType,
            primaryExchange: item.primaryExchange,
          } satisfies SymbolRecord;
        }
        return null;
      })
      .filter((entry): entry is SymbolRecord => Boolean(entry));
  } catch {
    return [];
  }
}

function normalizeSymbols(input: unknown): SymbolRecord[] {
  const seen = new Set<string>();
  const records: SymbolRecord[] = [];
  const container = input && typeof input === 'object' ? (input as { symbols?: unknown }) : undefined;
  const rawEntries = Array.isArray(container?.symbols) ? container?.symbols : input;

  if (!Array.isArray(rawEntries)) return records;

  for (const entry of rawEntries) {
    let record: SymbolRecord | null = null;
    if (typeof entry === 'string') {
      const symbol = entry.trim().toUpperCase();
      if (symbol) record = { symbol };
    } else if (entry && typeof entry === 'object') {
      const symbol = String(entry.symbol || '').trim().toUpperCase();
      if (!symbol) continue;
      record = {
        symbol,
        exchange: entry.exchange ? String(entry.exchange) : undefined,
        currency: entry.currency ? String(entry.currency) : undefined,
        secType: entry.secType ? String(entry.secType) : undefined,
        primaryExchange: entry.primaryExchange ? String(entry.primaryExchange) : undefined,
      };
    }
    if (record && !seen.has(record.symbol)) {
      seen.add(record.symbol);
      records.push(record);
    }
  }
  return records;
}

async function writeSymbols(symbols: SymbolRecord[]) {
  await fs.mkdir(path.dirname(SYMBOLS_PATH), { recursive: true });
  const payload = {
    symbols,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(SYMBOLS_PATH, JSON.stringify(payload, null, 2), 'utf-8');
}

export const runtime = 'nodejs';

export async function GET() {
  const symbols = await readSymbols();
  return NextResponse.json({ symbols });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const symbols = normalizeSymbols(body);
  if (symbols.length === 0) {
    return NextResponse.json({ ok: false, error: 'no-symbols' }, { status: 400 });
  }
  await writeSymbols(symbols);
  return NextResponse.json({ ok: true, symbols });
}
