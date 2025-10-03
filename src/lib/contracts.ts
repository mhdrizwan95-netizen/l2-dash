// Server-Sent Events (SSE) contracts for L2 HMM Trading System

// Type guards
export const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

export const isString = (x: unknown): x is string => typeof x === 'string';
export const isNumber = (x: unknown): x is number => typeof x === 'number';
export const isBoolean = (x: unknown): x is boolean => typeof x === 'boolean';

// Sample payload builders for development/testing
export const buildSamplePayload = {
  fill: (symbol: string, price: number, qty: number): FillEvent => ({
    event: 'fill',
    symbol,
    price,
    qty,
    timestamp: Date.now(),
  }),
  tick: (symbol: string, bid: number, ask: number): TickEvent => ({
    event: 'tick',
    symbol,
    bid,
    ask,
    timestamp: Date.now(),
  }),
  hmmState: (symbol: string, state: number, prob: number): HmmStateEvent => ({
    event: 'hmm_state',
    symbol,
    state,
    probability: prob,
    timestamp: Date.now(),
  }),
  health: (service: string, status: 'healthy' | 'degraded' | 'unhealthy'): HealthEvent => ({
    event: 'health',
    service,
    status,
    timestamp: Date.now(),
  }),
  guardrail: (code: GuardrailCode, active: boolean, message?: string): GuardrailEvent => ({
    event: 'guardrail',
    code,
    active,
    message,
    timestamp: Date.now(),
  }),
  latency: (service: 'ml' | 'exec', ms: number): LatencyEvent => ({
    event: 'latency',
    service,
    latency_ms: ms,
    timestamp: Date.now(),
  }),
  suggestExec: (id: string, symbol: string, side: 'BUY' | 'SELL', quantity: number, price: number, executed: boolean, reason?: string): SuggestExecEvent => ({
    event: 'suggest_exec',
    id,
    symbol,
    side,
    quantity,
    price,
    executed,
    reason,
    timestamp: Date.now(),
  }),
  brokerStatus: (status: 'connected' | 'connecting' | 'disconnected', error?: string): BrokerStatusEvent => ({
    event: 'broker_status',
    status,
    error,
    timestamp: Date.now(),
  }),
  brokerFill: (id: string, symbol: string, price: number, qty: number, commission: number): BrokerFillEvent => ({
    event: 'broker_fill',
    id,
    symbol,
    price,
    qty,
    commission,
    timestamp: Date.now(),
  }),
} as const;

// Base event interface
export interface SseEvent {
  event: string;
  timestamp: number;
}

// /exec/fills - Order execution fills
export interface FillEvent extends SseEvent {
  event: 'fill';
  symbol: string;
  price: number;
  qty: number;
}

// Type guard for FillEvent
export const isFillEvent = (x: unknown): x is FillEvent =>
  isObject(x) &&
  x.event === 'fill' &&
  isString(x.symbol) &&
  isNumber(x.price) &&
  isNumber(x.qty) &&
  isNumber(x.timestamp);

// /blotter/ticks - Market data ticks
export interface TickEvent extends SseEvent {
  event: 'tick';
  symbol: string;
  bid: number;
  ask: number;
}

// Type guard for TickEvent
export const isTickEvent = (x: unknown): x is TickEvent =>
  isObject(x) &&
  x.event === 'tick' &&
  isString(x.symbol) &&
  isNumber(x.bid) &&
  isNumber(x.ask) &&
  isNumber(x.timestamp);

// /hmm/state - HMM model state updates
export interface HmmStateEvent extends SseEvent {
  event: 'hmm_state';
  symbol: string;
  state: number; // HMM state index
  probability: number; // Confidence probability
}

// Type guard for HmmStateEvent
export const isHmmStateEvent = (x: unknown): x is HmmStateEvent =>
  isObject(x) &&
  x.event === 'hmm_state' &&
  isString(x.symbol) &&
  isNumber(x.state) &&
  isNumber(x.probability) &&
  isNumber(x.timestamp);

// /health/all - Service health status
export interface HealthEvent extends SseEvent {
  event: 'health';
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
}

// Type guard for HealthEvent
export const isHealthEvent = (x: unknown): x is HealthEvent =>
  isObject(x) &&
  x.event === 'health' &&
  isString(x.service) &&
  (x.status === 'healthy' || x.status === 'degraded' || x.status === 'unhealthy') &&
  isNumber(x.timestamp);

// /exec/guardrails - Guardrail status updates
export type GuardrailCode =
  | 'SPREAD'    // Spread too wide
  | 'POS'       // Position limits
  | 'COOL'      // Cooldown period active
  | 'LAT'       // High latency
  | 'DD'        // Drawdown too large
  | 'KILL'      // Emergency kill switch
  | 'CONF'      // Low confidence
  | 'DRIFT';    // Model drift detected

export interface GuardrailEvent extends SseEvent {
  event: 'guardrail';
  code: GuardrailCode;
  active: boolean;
  message?: string;
}

// Type guard for GuardrailEvent
export const isGuardrailEvent = (x: unknown): x is GuardrailEvent =>
  isObject(x) &&
  x.event === 'guardrail' &&
  isString(x.code) &&
  (x.code === 'SPREAD' || x.code === 'POS' || x.code === 'COOL' || x.code === 'LAT' ||
   x.code === 'DD' || x.code === 'KILL' || x.code === 'CONF' || x.code === 'DRIFT') &&
  isBoolean(x.active) &&
  (x.message === undefined || isString(x.message)) &&
  isNumber(x.timestamp);

// /ml/latency - ML service latency measurements
export interface LatencyEvent extends SseEvent {
  event: 'latency';
  service: 'ml' | 'exec';
  latency_ms: number;
}

// Type guard for LatencyEvent
export const isLatencyEvent = (x: unknown): x is LatencyEvent =>
  isObject(x) &&
  x.event === 'latency' &&
  (x.service === 'ml' || x.service === 'exec') &&
  isNumber(x.latency_ms) &&
  isNumber(x.timestamp);

// /exec/suggest_exec - Order suggestions and their execution status
export interface SuggestExecEvent extends SseEvent {
  event: 'suggest_exec';
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  executed: boolean;
  reason?: string;
}

// Type guard for SuggestExecEvent
export const isSuggestExecEvent = (x: unknown): x is SuggestExecEvent =>
  isObject(x) &&
  x.event === 'suggest_exec' &&
  isString(x.id) &&
  isString(x.symbol) &&
  (x.side === 'BUY' || x.side === 'SELL') &&
  isNumber(x.quantity) &&
  isNumber(x.price) &&
  isBoolean(x.executed) &&
  (x.reason === undefined || isString(x.reason)) &&
  isNumber(x.timestamp);

// /broker/status - Broker connection status updates
export interface BrokerStatusEvent extends SseEvent {
  event: 'broker_status';
  status: 'connected' | 'connecting' | 'disconnected';
  error?: string;
}

// Type guard for BrokerStatusEvent
export const isBrokerStatusEvent = (x: unknown): x is BrokerStatusEvent =>
  isObject(x) &&
  x.event === 'broker_status' &&
  (x.status === 'connected' || x.status === 'connecting' || x.status === 'disconnected') &&
  (x.error === undefined || isString(x.error)) &&
  isNumber(x.timestamp);

// /broker/fills - Broker-specific fill confirmations
export interface BrokerFillEvent extends SseEvent {
  event: 'broker_fill';
  id: string; // Broker-assigned order ID
  symbol: string;
  price: number;
  qty: number;
  commission: number;
}

// Type guard for BrokerFillEvent
export const isBrokerFillEvent = (x: unknown): x is BrokerFillEvent =>
  isObject(x) &&
  x.event === 'broker_fill' &&
  isString(x.id) &&
  isString(x.symbol) &&
  isNumber(x.price) &&
  isNumber(x.qty) &&
  isNumber(x.commission) &&
  isNumber(x.timestamp);

// Union type for all possible SSE events
export type SseEventUnion =
  | FillEvent
  | TickEvent
  | HmmStateEvent
  | HealthEvent
  | GuardrailEvent
  | LatencyEvent
  | SuggestExecEvent
  | BrokerStatusEvent
  | BrokerFillEvent;

// Type guard for any SSE event
export const isSseEventUnion = (x: unknown): x is SseEventUnion =>
  isFillEvent(x) || isTickEvent(x) || isHmmStateEvent(x) ||
  isHealthEvent(x) || isGuardrailEvent(x) || isLatencyEvent(x) ||
  isSuggestExecEvent(x) || isBrokerStatusEvent(x) || isBrokerFillEvent(x);
