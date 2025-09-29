import * as fs from 'fs';
import { cfg, ensureDirs } from '../config';
import type { Fill } from '../broker/ibkr';

const headers = ['timestamp','orderId','strategyId','symbol','side','qty','price','fee','notional','session'];

function toCsvRow(f: Fill): string {
  const notional = (f.price * f.qty).toFixed(2);
  const row = [f.timestamp,f.orderId,f.strategyId,f.symbol,f.side,f.qty,f.price,f.fee,notional, cfg.ibkr.mode];
  return row.map(String).join(',');
}

export function initJournal() {
  ensureDirs();
  const p = cfg.journal.csvPath;
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, headers.join(',') + '\n', 'utf8');
  } else {
    const firstLine = fs.readFileSync(p, 'utf8').split('\n')[0]?.trim();
    if (firstLine !== headers.join(',')) {
      const content = fs.readFileSync(p, 'utf8');
      fs.writeFileSync(p, headers.join(',') + '\n' + content, 'utf8');
    }
  }
}

export function recordFill(fill: Fill) {
  initJournal();
  fs.appendFileSync(cfg.journal.csvPath, toCsvRow(fill) + '\n', 'utf8');
}
