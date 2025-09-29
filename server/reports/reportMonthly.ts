// reportMonthly.ts
import fs from "node:fs";
import { unrealizedFromOpenLots } from "./lib/mtm";

const journalPath = process.env.FILLS_JOURNAL_CSV || "./data/fills.csv";
const monthKey = new Date().toISOString().slice(0, 7); // YYYY-MM

type Fill = {
  ts: string;
  orderId: string;
  strategyId: string;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
  fee: number;
  notional: number;
  session: string;
};

function parse(line: string): Fill | null {
  const [ts, orderId, strategyId, symbol, side, qty, price, fee, notional, session] = line.split(",");
  const f: Fill = {
    ts,
    orderId,
    strategyId,
    symbol,
    side: side as "BUY" | "SELL",
    qty: Number(qty),
    price: Number(price),
    fee: Number(fee),
    notional: Number(notional),
    session,
  };
  if (!(f.qty > 0 && f.price > 0)) return null;
  return f;
}

function realizedPnlFIFO(fills: Fill[]) {
  const books: Record<string, { qty: number; price: number }[]> = {};
  let realized = 0;
  let fees = 0;

  for (const f of fills) {
    fees += f.fee || 0;
    const book = books[f.symbol] || (books[f.symbol] = []);
    if (f.side === "BUY") {
      book.push({ qty: f.qty, price: f.price });
    } else {
      let qty = f.qty;
      while (qty > 0 && book.length) {
        const lot = book[0];
        const use = Math.min(qty, lot.qty);
        realized += (f.price - lot.price) * use;
        lot.qty -= use;
        qty -= use;
        if (lot.qty === 0) book.shift();
      }
    }
  }
  return { realized, fees, openLots: books };
}

async function main() {
  if (!fs.existsSync(journalPath)) {
    console.log(`No journal at ${journalPath}`);
    return;
  }
  const text = fs.readFileSync(journalPath, "utf8").trim();
  if (!text) {
    console.log("=== Monthly Report ===");
    console.log("No entries.");
    return;
  }
  const lines = text.split("\n");
  const fills = lines.map(parse).filter(Boolean) as Fill[];
  const thisMonth = fills.filter((f) => f.ts.startsWith(monthKey));

  const { realized, fees, openLots } = realizedPnlFIFO(thisMonth);
  const unreal = await unrealizedFromOpenLots(openLots);

  console.log("=== Monthly Report ===");
  console.log("Session:", process.env.IBKR_MODE || "paper");
  console.log("Month (UTC):", monthKey);
  console.log("Trades this month:", thisMonth.length);
  console.log("Gross Realized:", realized.toFixed(2));
  console.log("Unrealized:", unreal.toFixed(2));
  console.log("Fees:", fees.toFixed(2));
  console.log("Net PnL:", (realized + unreal - fees).toFixed(2));
}

main().catch((e) => {
  console.error("Monthly report error:", e);
  process.exit(1);
});
