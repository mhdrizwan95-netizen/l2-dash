import fs from 'fs/promises';
import path from 'path';

const COMMAND_DIR = path.join(process.cwd(), 'sessions', 'commands');

export async function recordCommand(command: string, extra?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    command,
    ...(extra ?? {}),
  };
  await fs.mkdir(COMMAND_DIR, { recursive: true });
  const filename = `${command}-${Date.now()}.json`;
  const filePath = path.join(COMMAND_DIR, filename);
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
}

export { COMMAND_DIR };
