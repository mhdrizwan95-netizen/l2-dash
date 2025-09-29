import fs from "fs";
import path from "path";

function todayUTCDateString(d = new Date()): string {
  const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
  return iso.slice(0,10);
}

function readSession(dateUTC: string) {
  const p = path.resolve("sessions", `${dateUTC}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

(function main() {
  const dateUTC = todayUTCDateString();
  const s = readSession(dateUTC);

  console.log("=== Daily Report (File Strategies) ===");
  console.log(`Date (UTC): ${dateUTC}`);

  if (!s) {
    console.log("No session file found. Run: npm run strategies:run");
    process.exit(0);
  }

  const fills = s.fills || [];
  console.log(`Fills today: ${fills.length}`);
  console.log(`Gross Realized: ${(s.totals?.grossRealized ?? 0).toFixed(2)}`);
  console.log(`Fees: ${(s.totals?.fees ?? 0).toFixed(2)}`);
  console.log(`Net PnL: ${(s.totals?.netPnL ?? 0).toFixed(2)}`);
})();
