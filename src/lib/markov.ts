import { bus } from '@/lib/bus';

type MarkovState = 0 | 1 | 2;

type MarkovSnapshot = {
  symbol: string;
  counts: number[];
  P: number[][];
  lastState: MarkovState | null;
  next: [number, number, number] | null;
  ts: number;
};

function stateFromDelta(delta: number, flatEps = 1e-6): MarkovState {
  if (delta > flatEps) return 2;
  if (delta < -flatEps) return 0;
  return 1;
}

class Markov3 {
  private counts = new Uint32Array(9);
  private lastState: MarkovState | null = null;
  private lastEmit = 0;

  public lastPrice: number | null = null;

  constructor(private readonly symbol: string) {}

  observe(prev: number, curr: number) {
    const state = stateFromDelta(curr - prev);
    if (this.lastState !== null) {
      this.counts[this.lastState * 3 + state] += 1;
    }
    this.lastState = state;
  }

  probs(): number[][] {
    const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]] as number[][];
    for (let row = 0; row < 3; row += 1) {
      const base = row * 3;
      const a = this.counts[base];
      const b = this.counts[base + 1];
      const c = this.counts[base + 2];
      const total = a + b + c;
      if (total > 0) {
        matrix[row][0] = a / total;
        matrix[row][1] = b / total;
        matrix[row][2] = c / total;
      }
    }
    return matrix;
  }

  next(): [number, number, number] | null {
    if (this.lastState === null) return null;
    const matrix = this.probs();
    return [matrix[this.lastState][0], matrix[this.lastState][1], matrix[this.lastState][2]];
  }

  snapshot(): MarkovSnapshot {
    return {
      symbol: this.symbol,
      counts: Array.from(this.counts),
      P: this.probs(),
      lastState: this.lastState,
      next: this.next(),
      ts: Date.now(),
    };
  }

  maybePublish(interval = 1000) {
    const now = Date.now();
    if (now - this.lastEmit < interval) return;
    this.lastEmit = now;
    bus.publish({ type: 'markov', payload: this.snapshot() });
  }
}

const registry = new Map<string, Markov3>();

export function markovBySymbol(symbol: string) {
  let mk = registry.get(symbol);
  if (!mk) {
    mk = new Markov3(symbol);
    registry.set(symbol, mk);
  }
  return mk;
}

export type { MarkovSnapshot };
