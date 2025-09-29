// mtm.ts
const IB_BASE = process.env.IBKR_BASE_URL || "http://127.0.0.1:8001";

export async function lastPrice(symbol: string): Promise<number> {
  const url = `${IB_BASE}/bars?symbol=${encodeURIComponent(symbol)}&duration=1%20D&barSize=1%20min`;
  const res = await fetch(url);
  if (!res.ok) return NaN;
  const bars = await res.json();
  if (!Array.isArray(bars) || bars.length === 0) return NaN;
  const last = bars[bars.length - 1];
  const px = Number(last?.close);
  return Number.isFinite(px) ? px : NaN;
}

export async function unrealizedFromOpenLots(openLots: Record<string, { qty: number; price: number }[]>): Promise<number> {
  let unreal = 0;
  for (const [sym, lots] of Object.entries(openLots)) {
    const px = await lastPrice(sym);
    if (!Number.isFinite(px)) continue;
    for (const lot of lots) {
      if (lot.qty > 0) unreal += (px - lot.price) * lot.qty;
      else if (lot.qty < 0) unreal += (lot.price - px) * Math.abs(lot.qty);
    }
  }
  return unreal;
}
