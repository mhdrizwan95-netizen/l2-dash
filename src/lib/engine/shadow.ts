export type Side = 'BUY' | 'SELL';
export type ShadowOrder = { id: string; side: Side; price: number; qty: number; ts: number };
export type ShadowFill = { orderId: string; ts: number; avgPx: number; qty: number };

export class QueueAwareSimulator {
  latencyMs = 60;
  private orders: Map<string, ShadowOrder> = new Map();
  private queueAhead: Record<Side, Map<number, number>> = { BUY: new Map(), SELL: new Map() };
  private execdSince: Record<Side, Map<number, number>> = { BUY: new Map(), SELL: new Map() };
  private latestBids: Array<[number, number]> = [];
  private latestAsks: Array<[number, number]> = [];

  onBook(bids: Array<[number, number]>, asks: Array<[number, number]>) {
    this.latestBids = bids; this.latestAsks = asks;
  }
  onTrade(price: number, size: number, aggressor: Side) {
    const sideHit: Side = aggressor === 'BUY' ? 'SELL' : 'BUY';
    const m = this.execdSince[sideHit];
    m.set(price, (m.get(price) || 0) + size);
  }
  placeLimit(o: ShadowOrder) {
    this.orders.set(o.id, o);
    const qa = this.queueAhead[o.side];
    qa.set(o.price, (qa.get(o.price) || 0) + this.displayedSize(o.side, o.price));
  }
  cancel(id: string) { this.orders.delete(id); }
  tryFills(now: number): ShadowFill[] {
    const fills: ShadowFill[] = [];
    for (const o of Array.from(this.orders.values())) {
      if (now - o.ts < this.latencyMs / 1000) continue;
      const exec = (this.execdSince[o.side].get(o.price) || 0) - (this.queueAhead[o.side].get(o.price) || 0);
      if (exec <= 0) continue;
      const qty = Math.min(exec, o.qty);
      fills.push({ orderId: o.id, ts: now, avgPx: o.price, qty });
      this.orders.delete(o.id);
    }
    return fills;
  }
  private displayedSize(side: Side, price: number) {
    const book = side === 'BUY' ? this.latestBids : this.latestAsks;
    for (const [px, sz] of book) if (Math.abs(px - price) < 1e-9) return sz;
    return 0;
  }
}
export const shadowSim = new QueueAwareSimulator();
