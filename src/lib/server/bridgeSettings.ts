import fs from 'fs/promises';
import path from 'path';
import { BridgeSettings, normalizeBridgeSettings, mergeBridgeSettings } from '@/lib/settingsSchema';

const SETTINGS_PATH = path.join(process.cwd(), 'sessions', 'bridge-settings.json');

async function readFileOrNull(): Promise<Partial<BridgeSettings> | null> {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf-8');
    if (!raw.trim()) return null;
    return JSON.parse(raw) as Partial<BridgeSettings>;
  } catch {
    return null;
  }
}

export async function readBridgeSettings(): Promise<BridgeSettings> {
  const file = await readFileOrNull();
  return normalizeBridgeSettings(file ?? undefined);
}

export async function writeBridgeSettings(patch: unknown): Promise<BridgeSettings> {
  const current = await readBridgeSettings();
  const next = mergeBridgeSettings(current, patch);
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

export { SETTINGS_PATH };
