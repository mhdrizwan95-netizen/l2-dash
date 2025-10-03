const MAX_TICKS_PER_SYMBOL = 3600;
const MAX_FILLS = 5000;
const MAX_GUARDRAILS = 2000;

export type TickRecord = {
  symbol: string;
  price: number;
  ts: number;
};

export type FillRecord = {
  orderId: string;
  symbol: string;
  qty: number;
  px: number;
  ts: number;
  kind?: string;
};

export type GuardrailRecord = {
  rule: string;
  message: string;
  symbol?: string;
  ts: number;
  severity?: 'info' | 'warn' | 'block';
};

type PositionRecord = {
  symbol: string;
  qty: number;
  avgPx: number;
  realized: number;
};

export type AccountSnapshot = {
  ts: number;
  cash: number;
  availableFunds: number;
  buyingPower: number;
  marginUsed: number;
  netLiquidation: number;
  equityWithLoan: number;
};

export type PositionSnapshot = {
  symbol: string;
  qty: number;
  avgPx: number;
  lastPx: number;
  notional: number;
  realized: number;
  unrealized: number;
};

function updatePosition(current: PositionRecord, qtyDelta: number, price: number): PositionRecord {
  const before = current.qty;
  const after = before + qtyDelta;
  let realized = current.realized;
  let avgPx = current.avgPx;

  if (before === 0) {
    avgPx = price;
  } else if (before > 0 && qtyDelta < 0) {
    const closing = Math.min(before, -qtyDelta);
    realized += (price - avgPx) * closing;
    if (after > 0) {
      avgPx = avgPx;
    } else if (after < 0) {
      avgPx = price;
    } else {
      avgPx = 0;
    }
  } else if (before < 0 && qtyDelta > 0) {
    const closing = Math.min(-before, qtyDelta);
    realized += (avgPx - price) * closing;
    if (after < 0) {
      avgPx = avgPx;
    } else if (after > 0) {
      avgPx = price;
    } else {
      avgPx = 0;
    }
  } else {
    avgPx = after !== 0 ? (avgPx * before + price * qtyDelta) / after : 0;
  }

  return { symbol: current.symbol, qty: after, avgPx: after === 0 ? 0 : avgPx, realized };
}

class SessionStore {
  private ticks = new Map<string, TickRecord[]>();
  private fills: FillRecord[] = [];
  private guardrails: GuardrailRecord[] = [];
  private positions = new Map<string, PositionRecord>();
  private lastPrice = new Map<string, number>();
  private account: AccountSnapshot | null = null;

  recordTick(record: TickRecord) {
    if (!Number.isFinite(record.price)) return;
    this.lastPrice.set(record.symbol, record.price);
    const list = this.ticks.get(record.symbol) ?? [];
    list.push(record);
    if (list.length > MAX_TICKS_PER_SYMBOL) {
      list.splice(0, list.length - MAX_TICKS_PER_SYMBOL);
    }
    this.ticks.set(record.symbol, list);
  }

  recordFill(fill: FillRecord) {
    this.fills.unshift(fill);
    if (this.fills.length > MAX_FILLS) {
      this.fills.length = MAX_FILLS;
    }
    const current = this.positions.get(fill.symbol) ?? {
      symbol: fill.symbol,
      qty: 0,
      avgPx: 0,
      realized: 0,
    };
    const next = updatePosition(current, fill.qty, fill.px);
    this.positions.set(fill.symbol, next);
  }

  recordGuardrail(event: GuardrailRecord) {
    this.guardrails.unshift(event);
    if (this.guardrails.length > MAX_GUARDRAILS) {
      this.guardrails.length = MAX_GUARDRAILS;
    }
  }

  recordAccount(snapshot: AccountSnapshot) {
    this.account = snapshot;
  }

  latestTicks() {
    return Array.from(this.ticks.entries()).map(([symbol, history]) => ({ symbol, history }));
  }

  allFills() {
    return this.fills.slice();
  }

  allGuardrails() {
    return this.guardrails.slice();
  }

  positionMap() {
    return Array.from(this.positions.values());
  }

  realizedPnL(): number {
    let total = 0;
    for (const pos of this.positions.values()) {
      total += pos.realized;
      const last = this.lastPrice.get(pos.symbol);
      if (last && pos.qty !== 0) {
        const mark = (last - pos.avgPx) * pos.qty;
        total += mark;
      }
    }
    return total;
  }

  exportFillsCsv(): string {
    const header = ['timestamp', 'orderId', 'symbol', 'side', 'qty', 'price', 'kind', 'notional'];
    const rows = [header.join(',')];
    for (const fill of [...this.fills].reverse()) {
      const side = fill.qty >= 0 ? 'BUY' : 'SELL';
      const notional = (fill.px * fill.qty).toFixed(2);
      const row = [
        new Date(fill.ts).toISOString(),
        fill.orderId,
        fill.symbol,
        side,
        fill.qty.toString(),
        fill.px.toFixed(4),
        fill.kind ?? 'paper',
        notional,
      ];
      rows.push(row.join(','));
    }
    return rows.join('\n');
  }

  fillsSnapshot(limit = 200): { total: number; items: FillRecord[] } {
    const bounded = Math.max(0, Math.min(limit, this.fills.length));
    return {
      total: this.fills.length,
      items: this.fills.slice(0, bounded),
    };
  }

  positionsSnapshot(): { positions: PositionSnapshot[]; totals: { netExposure: number; realized: number; unrealized: number; netPnl: number } } {
    const positions: PositionSnapshot[] = [];
    let netExposure = 0;
    let realized = 0;
    let unrealized = 0;

    for (const pos of this.positions.values()) {
      const last = this.lastPrice.get(pos.symbol) ?? pos.avgPx;
      const notional = last * pos.qty;
      const pnl = (last - pos.avgPx) * pos.qty;
      realized += pos.realized;
      unrealized += pnl;
      netExposure += notional;
      positions.push({
        symbol: pos.symbol,
        qty: pos.qty,
        avgPx: pos.avgPx,
        lastPx: last,
        notional,
        realized: pos.realized,
        unrealized: pnl,
      });
    }

    return {
      positions,
      totals: {
        netExposure,
        realized,
        unrealized,
        netPnl: realized + unrealized,
      },
    };
  }

  accountSnapshot(): AccountSnapshot | null {
    return this.account;
  }
}

const token = '__L2_SESSION_STORE__' as const;
type GlobalWithStore = typeof globalThis & { [token]?: SessionStore };

const globalScope = globalThis as GlobalWithStore;

export const sessionStore = globalScope[token] ?? new SessionStore();
if (!globalScope[token]) {
  globalScope[token] = sessionStore;
}
