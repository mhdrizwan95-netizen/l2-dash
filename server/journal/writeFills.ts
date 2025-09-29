// server/journal/writeFill.ts
import fs from "node:fs";
import path from "node:path";

export type FillRow = {
  timestamp: string;          // ISO UTC
  orderId: string | number;
  strategyId: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  fee?: number;               // positive cost
  session: "paper" | "live" | string;
};

/**
 * Append a fill to FILLS_JOURNAL_CSV.
 * Guards against bogus entries (qty<=0 or price<=0).
 * Columns: ts,orderId,strategyId,symbol,side,qty,price,fee,notional,session
 */
export function writeFill(row: FillRow) {
  if (!row) return;
  const qty = Number(row.qty);
  const price = Number(row.price);
  if (!Number.isFinite(qty) || !Number.isFinite(price)) return;
  if (qty <= 0 || price <= 0) return; // drop garbage rows

  const fee = Math.max(0, Number(row.fee ?? 0));
  const notional = qty * price;

  const out = [
    row.timestamp,
    String(row.orderId),
    row.strategyId,
    row.symbol,
    row.side,
    qty.toString(),
    price.toString(),
    fee.toString(),
    notional.toFixed(2),
    row.session,
  ].join(",");

  const p = process.env.FILLS_JOURNAL_CSV || "./data/fills.csv";
  const dir = path.dirname(p);
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(p, out + "\n");
}
