import fs from 'fs/promises';
import path from 'path';
import type { Layouts } from 'react-grid-layout';
import { cloneLayouts, sanitizeLayouts } from '@/lib/layoutUtils';
import { DEFAULT_DASHBOARD_LAYOUTS } from '@/lib/dashboardStore';

const STORE_PATH = path.join(process.cwd(), 'sessions', 'dashboard-layouts.json');
const FILE_VERSION = 1;

type LayoutMode = 'paper' | 'live';

type LayoutRecord = {
  layouts: Layouts;
  locked: boolean;
  savedAt: number;
};

type LayoutFile = {
  version: number;
  entries: Record<string, LayoutRecord>;
};

let cache: LayoutFile | null = null;

function createDefaultRecord(): LayoutRecord {
  return {
    layouts: cloneLayouts(DEFAULT_DASHBOARD_LAYOUTS),
    locked: false,
    savedAt: Date.now(),
  };
}

function buildKey(userId: string, mode: LayoutMode, symbol: string): string {
  return `${userId}::${mode}::${symbol}`;
}

function sanitizeSymbol(symbol: string): string {
  const trimmed = symbol.trim().toUpperCase();
  if (!trimmed) {
    return 'ALL';
  }
  return trimmed.slice(0, 32);
}

async function readFileFromDisk(): Promise<LayoutFile> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    if (!raw.trim()) {
      return { version: FILE_VERSION, entries: {} };
    }
    const parsed = JSON.parse(raw) as Partial<LayoutFile>;
    if (!parsed || typeof parsed !== 'object') {
      return { version: FILE_VERSION, entries: {} };
    }
    if (typeof parsed.version !== 'number' || !parsed.entries || typeof parsed.entries !== 'object') {
      return { version: FILE_VERSION, entries: {} };
    }
    const rawEntries = parsed.entries as Record<string, unknown>;
    const sanitizedEntries: Record<string, LayoutRecord> = {};
    for (const [key, value] of Object.entries(rawEntries ?? {})) {
      if (!value || typeof value !== 'object') {
        continue;
      }
      const record = value as Partial<LayoutRecord>;
      const layouts = sanitizeLayouts(record.layouts ?? null);
      if (!layouts) {
        continue;
      }
      sanitizedEntries[key] = {
        layouts,
        locked: typeof record.locked === 'boolean' ? record.locked : false,
        savedAt: typeof record.savedAt === 'number' ? record.savedAt : Date.now(),
      };
    }
    return {
      version: FILE_VERSION,
      entries: sanitizedEntries,
    };
  } catch {
    return { version: FILE_VERSION, entries: {} };
  }
}

async function ensureCache(): Promise<LayoutFile> {
  if (cache) {
    return cache;
  }
  cache = await readFileFromDisk();
  return cache;
}

async function persistCache(data: LayoutFile) {
  cache = data;
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export async function readUserLayout(
  userId: string,
  mode: LayoutMode,
  symbol: string,
): Promise<LayoutRecord> {
  const normalizedSymbol = sanitizeSymbol(symbol);
  const key = buildKey(userId, mode, normalizedSymbol);
  const data = await ensureCache();
  const existing = data.entries[key];
  if (existing) {
    return {
      layouts: cloneLayouts(existing.layouts),
      locked: existing.locked,
      savedAt: existing.savedAt,
    };
  }
  return createDefaultRecord();
}

export async function writeUserLayout(
  userId: string,
  mode: LayoutMode,
  symbol: string,
  layouts: Layouts,
  locked: boolean,
): Promise<LayoutRecord> {
  const normalizedSymbol = sanitizeSymbol(symbol);
  const key = buildKey(userId, mode, normalizedSymbol);
  const data = await ensureCache();
  const sanitizedLayouts = sanitizeLayouts(layouts) ?? cloneLayouts(DEFAULT_DASHBOARD_LAYOUTS);
  const record: LayoutRecord = {
    layouts: cloneLayouts(sanitizedLayouts),
    locked,
    savedAt: Date.now(),
  };
  data.entries[key] = record;
  await persistCache(data);
  return {
    layouts: cloneLayouts(record.layouts),
    locked: record.locked,
    savedAt: record.savedAt,
  };
}

export async function resetUserLayout(
  userId: string,
  mode: LayoutMode,
  symbol: string,
): Promise<LayoutRecord> {
  const normalizedSymbol = sanitizeSymbol(symbol);
  const key = buildKey(userId, mode, normalizedSymbol);
  const data = await ensureCache();
  const record = createDefaultRecord();
  data.entries[key] = record;
  await persistCache(data);
  return {
    layouts: cloneLayouts(record.layouts),
    locked: record.locked,
    savedAt: record.savedAt,
  };
}

export function getDefaultLayoutRecord(): LayoutRecord {
  return createDefaultRecord();
}

export type { LayoutMode, LayoutRecord };
export { STORE_PATH as LAYOUT_STORE_PATH };
