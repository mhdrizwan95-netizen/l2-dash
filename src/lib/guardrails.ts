import { randomUUID } from 'crypto';
import { bus, type BusEvent } from '@/lib/bus';

type GuardrailSeverity = 'info' | 'warn' | 'block';

export type GuardrailEvent = {
  id: string;
  ts: number;
  rule: string;
  message: string;
  severity: GuardrailSeverity;
  symbol?: string;
};

type TickPayload = {
  symbol?: string;
  price: number;
  ts?: number;
};

class GuardrailEngine {
  private lastTick = new Map<string, { price: number; ts: number }>();
  private lastFire = new Map<string, number>();
  private spikeWindow = new Map<string, { count: number; resetAt: number }>();
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.unsubscribe = bus.subscribe((event: BusEvent) => {
      if (!event || event.type !== 'tick') return;
      const payload = event.payload;
      if (!payload || typeof payload !== 'object') return;
      this.onTick(payload as TickPayload);
    });
  }

  private onTick(tick: TickPayload) {
    if (typeof tick.price !== 'number') return;
    const symbol = tick.symbol ?? 'MOCK';
    const ts = typeof tick.ts === 'number' ? tick.ts : Date.now();
    const prev = this.lastTick.get(symbol);
    if (prev) {
      const delta = tick.price - prev.price;
      const pct = prev.price !== 0 ? Math.abs(delta / prev.price) : 0;
      const secs = (ts - prev.ts) / 1000;
      if (pct >= 0.0025 && secs <= 3) {
        this.raisePriceSpike(symbol, pct, secs, ts);
      }
    }
    this.lastTick.set(symbol, { price: tick.price, ts });
  }

  private raisePriceSpike(symbol: string, pct: number, secs: number, ts: number) {
    const key = `${symbol}:spike`;
    const last = this.lastFire.get(key) ?? 0;
    if (ts - last < 1500) return;

    const win = this.spikeWindow.get(symbol) ?? { count: 0, resetAt: 0 };
    const nowWindow = ts > win.resetAt ? { count: 0, resetAt: ts + 10000 } : win;
    nowWindow.count += 1;
    nowWindow.resetAt = ts + 10000;
    this.spikeWindow.set(symbol, nowWindow);

    const severity: GuardrailSeverity = nowWindow.count >= 3 ? 'block' : 'warn';
    const message = `${symbol} moved ${(pct * 100).toFixed(2)}% in ${secs.toFixed(2)}s`;
    this.emit({ id: randomUUID(), ts, rule: 'PRICE_SPIKE', message, severity, symbol });
    this.lastFire.set(key, ts);
  }

  private emit(event: GuardrailEvent) {
    bus.publish({ type: 'guardrail', payload: event });
  }

  close() {
    this.unsubscribe?.();
  }
}

const globalToken = Symbol.for('l2dash.guardrails');
const globalScope = globalThis as typeof globalThis & { [globalToken]?: GuardrailEngine };

export const guardrails = globalScope[globalToken] ?? new GuardrailEngine();
if (!globalScope[globalToken]) globalScope[globalToken] = guardrails;

export type { GuardrailSeverity };
