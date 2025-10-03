import fs from 'fs/promises';
import path from 'path';
import type { ControlCommand } from '@/lib/controlTypes';

const STATE_PATH = path.join(process.cwd(), 'sessions', 'control-state.json');

type ControlStateFile = {
  last: ControlCommand;
};

let cached: ControlCommand | null | undefined;

function sanitizeCommand(input: unknown): ControlCommand | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const record = input as Record<string, unknown>;
  const kind = record.kind;
  const ts = record.ts;
  if (typeof kind !== 'string' || typeof ts !== 'number' || !Number.isFinite(ts)) {
    return null;
  }
  const payload = typeof record.payload === 'object' && record.payload !== null
    ? (record.payload as Record<string, unknown>)
    : undefined;
  const source = typeof record.source === 'string' ? record.source : undefined;
  return { kind: kind as ControlCommand['kind'], ts, payload, source };
}

async function readFromDisk(): Promise<ControlCommand | null> {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf-8');
    if (!raw.trim()) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<ControlStateFile>;
    return sanitizeCommand(parsed?.last ?? null);
  } catch {
    return null;
  }
}

async function writeToDisk(command: ControlCommand): Promise<void> {
  const file: ControlStateFile = { last: command };
  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(file, null, 2), 'utf-8');
}

export async function getLastCommand(): Promise<ControlCommand | null> {
  if (cached !== undefined) {
    return cached;
  }
  cached = await readFromDisk();
  return cached ?? null;
}

export async function setLastCommand(command: ControlCommand): Promise<void> {
  cached = command;
  await writeToDisk(command);
}

export { STATE_PATH as CONTROL_STATE_PATH };
