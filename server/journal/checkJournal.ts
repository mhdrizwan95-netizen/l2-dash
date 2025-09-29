// checkJournal.ts
import fs from "node:fs";

const p = process.env.FILLS_JOURNAL_CSV || "./data/fills.csv";
if (!fs.existsSync(p)) {
  console.log(`No journal found at ${p}`);
  process.exit(0);
}

const text = fs.readFileSync(p, "utf8").trim();
if (!text) {
  console.log(`Journal path: ${p}\nEntries: 0`);
  process.exit(0);
}

const lines = text.split("\n");
const entries = lines.length;

function parse(line: string) {
  const [ts, orderId, strategyId, symbol, side, qty, price, fee, notional, session] = line.split(",");
  return {
    ts,
    orderId,
    strategyId,
    symbol,
    side,
    qty: Number(qty),
    price: Number(price),
    fee: Number(fee),
    notional: Number(notional),
    session,
  };
}

const rows = lines.map(parse);
const bad = rows.filter((r) => !(r.qty > 0 && r.price > 0));
const last = rows.slice(-3);

console.log(`Journal path: ${p}`);
console.log(`Entries: ${entries}`);
if (last.length) {
  console.log("Last 3:");
  for (const r of last) {
    console.log(
      `${r.ts},${r.orderId},${r.strategyId},${r.symbol},${r.side},${r.qty},${r.price},${r.fee},${r.notional},${r.session}`
    );
  }
}
if (bad.length) {
  console.log(`Bad rows (qty<=0 or price<=0): ${bad.length}`);
}
