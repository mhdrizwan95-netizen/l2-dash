import { useEffect, useRef, useState, useCallback } from 'react';
import { isSseEventUnion, SseEventUnion, TickEvent, HmmStateEvent, FillEvent, HealthEvent } from './contracts';

// Connection states
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

// Reconnection configuration
const RECONNECT_CONFIG = {
  initialDelay: 1000,    // 1 second
  maxDelay: 30000,       // 30 seconds
  backoffMultiplier: 1.5,
  maxAttempts: 10,       // Stop trying after 10 failures
};

export interface UseDevSseOptions {
  enabled?: boolean;
  onEvent?: (event: SseEventUnion) => void;
  onStateChange?: (state: ConnectionState) => void;
}

export interface UseDevSseResult {
  state: ConnectionState;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
}

export function useDevSseClient(options: UseDevSseOptions = {}): UseDevSseResult {
  const { enabled = true, onEvent, onStateChange } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectDelayRef = useRef(RECONNECT_CONFIG.initialDelay);

  const updateState = useCallback((newState: ConnectionState) => {
    setConnectionState(newState);
    onStateChange?.(newState);
  }, [onStateChange]);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return;

    updateState('connecting');

    try {
      const eventSource = new EventSource('/api/dev/sse');

      eventSource.onopen = () => {
        console.log('[DevSSE] Connection opened');
        updateState('connected');
        reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
        reconnectDelayRef.current = RECONNECT_CONFIG.initialDelay; // Reset delay
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Validate event structure
          if (data && typeof data === 'object' && 'event' in data) {
            // Use type guard if available
            if (isSseEventUnion) {
              if (isSseEventUnion(data)) {
                onEvent?.(data);
              } else {
                console.warn('[DevSSE] Received invalid event:', data);
              }
            } else {
              // Fallback for basic validation
              onEvent?.(data);
            }
          } else if (data?.event === 'control') {
            console.log('[DevSSE] Control message:', data.message);
          } else {
            console.warn('[DevSSE] Invalid event format:', data);
          }
        } catch (error) {
          console.error('[DevSSE] Failed to parse event:', error, event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[DevSSE] Connection error:', error);
        updateState('error');

        // Start reconnection logic
        if (reconnectAttemptsRef.current < RECONNECT_CONFIG.maxAttempts) {
          updateState('reconnecting');

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            console.log(`[DevSSE] Reconnecting (attempt ${reconnectAttemptsRef.current}/${RECONNECT_CONFIG.maxAttempts})`);

            // Exponential backoff with jitter
            const jitter = Math.random() * 1000;
            const delay = Math.min(
              reconnectDelayRef.current * RECONNECT_CONFIG.backoffMultiplier,
              RECONNECT_CONFIG.maxDelay
            ) + jitter;

            reconnectDelayRef.current = delay;
            connect(); // Recursive call with incremented attempts
          }, reconnectDelayRef.current);
        } else {
          console.error('[DevSSE] Max reconnection attempts reached, giving up');
          updateState('error');
        }
      };



      eventSourceRef.current = eventSource;

    } catch (error) {
      console.error('[DevSSE] Failed to create EventSource:', error);
      updateState('error');
    }
  }, [enabled, updateState, onEvent]);

  const disconnect = useCallback(() => {
    console.log('[DevSSE] Disconnecting manually');
    cleanup();
    updateState('disconnected');
  }, [cleanup, updateState]);

  const reconnect = useCallback(() => {
    console.log('[DevSSE] Manual reconnection requested');
    disconnect();
    setTimeout(connect, 100); // Small delay to ensure cleanup
  }, [disconnect, connect]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (enabled && connectionState === 'disconnected') {
      connect();
    }

    return cleanup; // Cleanup on unmount
  }, [enabled, connect, cleanup]); // Remove connectionState to prevent loops

  // Cleanup on unmount or enabled change
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    state: connectionState,
    connect,
    disconnect,
    reconnect,
  };
}

// Additional utility hooks for specific event types
export function useDevSseTicks(onTick?: (tick: TickEvent) => void) {
  return useDevSseClient({
    onEvent: (event) => {
      if (event.event === 'tick') {
        onTick?.(event);
      }
    }
  });
}

export function useDevSseHmmStates(onStateUpdate?: (state: HmmStateEvent) => void) {
  return useDevSseClient({
    onEvent: (event) => {
      if (event.event === 'hmm_state') {
        onStateUpdate?.(event);
      }
    }
  });
}

export function useDevSseFills(onFill?: (fill: FillEvent) => void) {
  return useDevSseClient({
    onEvent: (event) => {
      if (event.event === 'fill') {
        onFill?.(event);
      }
    }
  });
}

export function useDevSseHealth(onHealth?: (health: HealthEvent) => void) {
  return useDevSseClient({
    onEvent: (event) => {
      if (event.event === 'health') {
        onHealth?.(event);
      }
    }
  });
}
