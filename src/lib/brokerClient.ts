import { useCockpitStore } from './cockpitStore';

// Order request interface matching Python schemas
export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price?: number;
  type: 'MKT' | 'LMT';
}

// Order acknowledgment response
export interface OrderAck {
  orderId: string;
}

// Generic response for operations
export interface OkResponse {
  ok: boolean;
}

// Error response for user feedback
export class BrokerError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'BrokerError';
  }
}

// Configuration for broker endpoints
const BROKER_CONFIG = {
  baseUrl: process.env.NODE_ENV === 'production' ?
    'http://127.0.0.1:5001' : // Live
    'http://127.0.0.1:5000', // Paper
  timeout: 10000, // 10 seconds
  maxRetries: 5,
  backoffMultiplier: 2,
  initialBackoff: 1000, // 1 second
};

// Helper for sleeping
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to make HTTP requests with retry and backoff
async function makeRequest<T>(
  endpoint: string,
  body: any,
  retries: number = BROKER_CONFIG.maxRetries
): Promise<T> {
  const url = `${BROKER_CONFIG.baseUrl}${endpoint}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BROKER_CONFIG.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new BrokerError(`HTTP ${response.status}: ${errorText}`, response.status.toString());
      }

      return await response.json();
    } catch (error) {
      if (error instanceof BrokerError) {
        throw error; // Re-throw broker errors immediately
      }

      if (attempt === retries) {
        throw new BrokerError(
          `Request failed after ${retries + 1} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'NETWORK_ERROR'
        );
      }

      // Exponential backoff
      const backoff = BROKER_CONFIG.initialBackoff * Math.pow(BROKER_CONFIG.backoffMultiplier, attempt);
      console.warn(`Request attempt ${attempt + 1} failed, retrying in ${backoff}ms:`, error);
      await sleep(backoff);
    }
  }

  throw new BrokerError('Unexpected error in request loop');
}

// Broker client class
class BrokerClient {
  private getTradingEnabled(): boolean {
    return useCockpitStore.getState().tradingEnabled;
  }

  async placeOrder(orderReq: OrderRequest): Promise<OrderAck> {
    if (!this.getTradingEnabled()) {
      throw new BrokerError('Trading is disabled', 'TRADING_DISABLED');
    }

    try {
      const response = await makeRequest<OrderAck>('/api/broker/place', {
        symbol: orderReq.symbol,
        order: {
          side: orderReq.side,
          qty: orderReq.qty,
          price: orderReq.price,
          type: orderReq.type,
        }
      });

      return response;
    } catch (error) {
      if (error instanceof BrokerError) {
        throw error;
      }
      throw new BrokerError(`Order placement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cancelOrder(orderId: string): Promise<OkResponse> {
    if (!this.getTradingEnabled()) {
      throw new BrokerError('Trading is disabled', 'TRADING_DISABLED');
    }

    try {
      const response = await makeRequest<OkResponse>('/api/broker/cancel', {
        orderId: orderId
      });

      return response;
    } catch (error) {
      if (error instanceof BrokerError) {
        throw error;
      }
      throw new BrokerError(`Order cancellation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async flattenAll(): Promise<OkResponse> {
    if (!this.getTradingEnabled()) {
      throw new BrokerError('Trading is disabled cannot flatten positions', 'TRADING_DISABLED');
    }

    try {
      const response = await makeRequest<OkResponse>('/api/broker/flatten_all', {});

      return response;
    } catch (error) {
      if (error instanceof BrokerError) {
        throw error;
      }
      throw new BrokerError(`Flatten all failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async flattenSymbol(symbol: string): Promise<OkResponse> {
    if (!this.getTradingEnabled()) {
      throw new BrokerError('Trading is disabled cannot flatten position', 'TRADING_DISABLED');
    }

    try {
      const response = await makeRequest<OkResponse>('/api/broker/flatten', {
        symbol: symbol
      });

      return response;
    } catch (error) {
      if (error instanceof BrokerError) {
        throw error;
      }
      throw new BrokerError(`Flatten ${symbol} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const brokerClient = new BrokerClient();
