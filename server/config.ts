import fs from 'fs';
import path from 'path';

type Config = {
  ibkr: {
    mode: string;
  };
  journal: {
    csvPath: string;
  };
};

const JOURNAL_DIR = path.join(process.cwd(), 'sessions', 'journals');

export const cfg: Config = {
  ibkr: {
    mode: process.env.IBKR_MODE ?? 'paper',
  },
  journal: {
    csvPath: path.join(JOURNAL_DIR, 'fills.csv'),
  },
};

export function ensureDirs() {
  fs.mkdirSync(path.dirname(cfg.journal.csvPath), { recursive: true });
}
