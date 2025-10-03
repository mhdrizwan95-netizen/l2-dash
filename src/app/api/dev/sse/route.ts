import { NextRequest } from 'next/server';
import { buildSamplePayload, SseEventUnion } from '@/lib/contracts';

export const runtime = 'nodejs';

// Synthetic symbols for development
const SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'ORCL', 'CRM'];

// Event emit intervals (Hz)
const TICK_INTERVAL = 20; // 20 Hz ticks
const HMM_INTERVAL = 5; // 5 Hz state updates
const FILL_INTERVAL = 0.5; // 0.5 Hz fills (once every 2 seconds)
const HEALTH_INTERVAL = 1; // 1 Hz health checks
const GUARDRAIL_INTERVAL = 0.1; // 0.1 Hz guardrail updates (once every 10 seconds)
const LATENCY_INTERVAL = 2; // 2 Hz latency metrics
const BROKER_STATUS_INTERVAL = 0.25; // 0.25 Hz broker status (once every 4 seconds)
const BROKER_FILL_INTERVAL = 0.3; // 0.3 Hz broker fills (simulate IBKR fills)

// Base prices for synthetic data
const BASE_PRICES: Record<string, number> = {
  AAPL: 150.0,
  MSFT: 300.0,
  GOOGL: 140.0,
  AMZN: 130.0,
  TSLA: 250.0,
  NVDA: 450.0,
  META: 350.0,
  NFLX: 400.0,
  ORCL: 85.0,
  CRM: 180.0,
};

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let aborted = false;

  // Simulation timers
  let tickTimer: NodeJS.Timeout | null = null;
  let hmmTimer: NodeJS.Timeout | null = null;
  let fillTimer: NodeJS.Timeout | null = null;
  let healthTimer: NodeJS.Timeout | null = null;
  let guardrailTimer: NodeJS.Timeout | null = null;
  let latencyTimer: NodeJS.Timeout | null = null;
  let brokerStatusTimer: NodeJS.Timeout | null = null;
  let brokerFillTimer: NodeJS.Timeout | null = null;

  // Random walk state for price simulation
  const priceState: Record<string, { price: number; trend: number }> = {};
  SYMBOLS.forEach(symbol => {
    priceState[symbol] = {
      price: BASE_PRICES[symbol],
      trend: (Math.random() - 0.5) * 0.002 // Small random trend
    };
  });

  // HMM state simulation
  const hmmStates: Record<string, number> = {};
  SYMBOLS.forEach(symbol => {
    hmmStates[symbol] = Math.floor(Math.random() * 3); // 0, 1, or 2 states
  });

  // Guardrail cycling
  const guardrails = ['SPREAD', 'POS', 'COOL', 'LAT', 'DD', 'KILL', 'CONF', 'DRIFT'] as const;
  let guardrailIndex = 0;

  // Broker status cycling
  const brokerStatuses = ['connected', 'connecting', 'connected', 'disconnected'] as const;
  let brokerStatusIndex = 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: SseEventUnion | { event: 'control', message: string, timestamp: number }) => {
        if (aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          aborted = true;
        }
      };

      const updatePrices = () => {
        SYMBOLS.forEach(symbol => {
          const state = priceState[symbol];
          // Random walk with mean reversion
          const change = (Math.random() - 0.5) * 0.01 + state.trend;
          state.price = Math.max(0.01, state.price * (1 + change));
          state.trend += (Math.random() - 0.5) * 0.0001; // Slow trend changes
        });
      };

      const emitTicks = () => {
        updatePrices();
        SYMBOLS.forEach(symbol => {
          const price = priceState[symbol].price;
          const spread = 0.001; // 0.1% spread
          const bid = price * (1 - spread);
          const ask = price * (1 + spread);
          send(buildSamplePayload.tick(symbol, bid, ask));
        });
      };

      const emitHmmStates = () => {
        SYMBOLS.forEach(symbol => {
          // Random state transitions with some persistence
          if (Math.random() < 0.1) { // 10% chance to change state
            hmmStates[symbol] = Math.floor(Math.random() * 3);
          }
          const probability = 0.5 + Math.random() * 0.4; // 0.5-0.9 confidence
          send(buildSamplePayload.hmmState(symbol, hmmStates[symbol], probability));
        });
      };

      const emitFills = () => {
        if (Math.random() < 0.3) { // 30% chance of fill each interval
          const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          const qty = Math.random() < 0.5 ? 100 : -100; // Buy or sell
          send(buildSamplePayload.fill(symbol, priceState[symbol].price, qty));
        }
      };

      const emitHealth = () => {
        const services = ['blotter', 'ml-service', 'algo', 'broker', 'dashboard'];
        const service = services[Math.floor(Math.random() * services.length)];
        const statuses = ['healthy', 'degraded', 'unhealthy'] as const;
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        send(buildSamplePayload.health(service, status));
      };

      const emitGuardrails = () => {
        const code = guardrails[guardrailIndex % guardrails.length];
        guardrailIndex++;
        const active = Math.random() < 0.2; // 20% chance active
        const messages = {
          SPREAD: 'Market spread exceeds threshold',
          POS: 'Position limits reached',
          COOL: 'Cooldown period active',
          LAT: 'High latency detected',
          DD: 'Drawdown too large',
          KILL: 'Emergency kill switch activated',
          CONF: 'Low model confidence',
          DRIFT: 'Model drift detected'
        };
        send(buildSamplePayload.guardrail(code, active, active ? messages[code] : undefined));
      };

      const emitLatency = () => {
        const services = ['ml', 'exec'] as const;
        const service = services[Math.floor(Math.random() * services.length)];
        const latency = 10 + Math.random() * 90; // 10-100ms
        send(buildSamplePayload.latency(service, latency));
      };

      const emitBrokerStatus = () => {
        const status = brokerStatuses[brokerStatusIndex % brokerStatuses.length];
        brokerStatusIndex++;
        const errorMsg = status === 'disconnected' ? 'Connection failed - retrying' : undefined;
        send(buildSamplePayload.brokerStatus(status, errorMsg));
      };

      const emitBrokerFill = () => {
        if (Math.random() < 0.4) { // 40% chance of broker fill each interval
          const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          const id = `IBKR-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          const price = priceState[symbol].price * (1 + (Math.random() - 0.5) * 0.01); // Slight slippage
          const qty = Math.random() < 0.5 ? 50 : -50; // Smaller fills
          const commission = 1.0 + Math.random() * 2.0; // $1-3 commission
          send(buildSamplePayload.brokerFill(id, symbol, price, qty, commission));
        }
      };

      // Send initial connection message
      send({ event: 'control', message: 'Dev SSE multiplexer started', timestamp: Date.now() });

      // Start simulation timers
      tickTimer = setInterval(emitTicks, 1000 / TICK_INTERVAL);
      hmmTimer = setInterval(emitHmmStates, 1000 / HMM_INTERVAL);
      fillTimer = setInterval(emitFills, 1000 / FILL_INTERVAL);
      healthTimer = setInterval(emitHealth, 1000 / HEALTH_INTERVAL);
      guardrailTimer = setInterval(emitGuardrails, 1000 / GUARDRAIL_INTERVAL);
      latencyTimer = setInterval(emitLatency, 1000 / LATENCY_INTERVAL);
      brokerStatusTimer = setInterval(emitBrokerStatus, 1000 / BROKER_STATUS_INTERVAL);
      brokerFillTimer = setInterval(emitBrokerFill, 1000 / BROKER_FILL_INTERVAL);

      req.signal.addEventListener('abort', () => {
        if (aborted) return;
        aborted = true;

        // Cleanup timers
        if (tickTimer) clearInterval(tickTimer);
        if (hmmTimer) clearInterval(hmmTimer);
        if (fillTimer) clearInterval(fillTimer);
        if (healthTimer) clearInterval(healthTimer);
        if (guardrailTimer) clearInterval(guardrailTimer);
        if (latencyTimer) clearInterval(latencyTimer);
        if (brokerStatusTimer) clearInterval(brokerStatusTimer);
        if (brokerFillTimer) clearInterval(brokerFillTimer);

        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
    cancel() {
      aborted = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
