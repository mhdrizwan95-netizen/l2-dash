'use client';

import { useEffect } from 'react';
import { useTelemetryStore } from '@/lib/telemetryStore';

type StreamEvent = { type: string; payload: unknown };

type Position = {
  qty: number;
  avgPx: number;
  lastFillTs: string;
  [key: string]: unknown;
};

type Tick = {
  symbol: string;
  price: number;
  ts: number;
  history: Array<{ ts: number; price: number }>;
  [key: string]: unknown;
};

type Guardrail = {
  ts: number;
  rule: string;
  symbol?: string;
  [key: string]: unknown;
};

type Fill = {
  symbol: string;
  qty: number;
  px: number;
  ts: number;
  [key: string]: unknown;
};

const MAX_BACKOFF_MS = 30_000;
const INITIAL_BACKOFF_MS = 1_000;

export function useTelemetryFeed(url = '/api/stream') {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let active = true;
    let source: EventSource | null = null;
    let lastEventTs = 0;
    const backoffRef = { current: INITIAL_BACKOFF_MS };
    const reconnectTimeoutRef = { current: null as ReturnType<typeof setTimeout> | null };

    // Load mock data first
    const loadMockData = async () => {
      try {
        const response = await fetch('/mock-telemetry.json');
        if (!response.ok) {
          console.warn('Mock data not found, using live stream');
          return connect();
        }
        const mockData = await response.json();
        console.log('Loading mock telemetry data...');

        // Load positions
        if (mockData.positions) {
          Object.entries(mockData.positions).forEach(([symbol, pos]: [string, unknown]) => {
            useTelemetryStore.getState().ingestEvent({
              type: 'fill',
              payload: {
                symbol,
                qty: (pos as Position).qty,
                px: (pos as Position).avgPx,
                ts: Date.parse((pos as Position).lastFillTs) || Date.now() - Math.random() * 86400000
              }
            });
          });
        }

        // Load ticks
        if (mockData.ticks) {
          Object.values(mockData.ticks).forEach((tick: unknown) => {
            useTelemetryStore.getState().ingestEvent({
              type: 'tick',
              payload: tick as Tick
            });
          });
        }

        // Load guardrails
        if (mockData.guardrails) {
          mockData.guardrails.forEach((gr: unknown) => {
            useTelemetryStore.getState().ingestEvent({
              type: 'guardrail',
              payload: gr as Guardrail
            });
          });
        }

        // Load HMM state
        if (mockData.markov) {
          useTelemetryStore.getState().ingestEvent({
            type: 'hmm_state',
            payload: mockData.markov
          });
        }

        // Load fills
        if (mockData.fills) {
          mockData.fills.forEach((fill: unknown) => {
            useTelemetryStore.getState().ingestEvent({
              type: 'fill',
              payload: fill as Fill
            });
          });
        }

        console.log('✅ Mock data loaded');
        useTelemetryStore.setState({ bridgeStatus: 'connected' });
      } catch (error) {
        console.warn('Mock data loading failed, using live stream:', error);
        connect();
      }
    };

    const connect = () => {
      if (!active) return;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      const es = new EventSource(url);
      source = es;

      es.onopen = () => {
        console.log('Telemetry feed connected');
        backoffRef.current = INITIAL_BACKOFF_MS;
        useTelemetryStore.setState({ bridgeStatus: 'connected' });
        // Attempt backfill if we have missed events
        if (lastEventTs > 0) {
          const now = Date.now();
          if (now - lastEventTs > 2000) {
            // Fetch missed events
            fetch(`/api/stream/backfill?since=${lastEventTs}`)
              .then(res => res.json())
              .then(events => {
                if (Array.isArray(events)) {
                  events.forEach((event: unknown) => {
                    try {
                      if (!event || typeof event !== 'object') return;
                      const typedEvent = event as Partial<StreamEvent>;
                      const eventType = typeof typedEvent.type === 'string' ? typedEvent.type : null;
                      if (eventType) {
                        useTelemetryStore.getState().ingestEvent({ type: eventType, payload: typedEvent.payload });
                      }
                    } catch {
                      /* ignore */
                    }
                  });
                }
              })
              .catch(() => console.warn('Backfill failed'));
          }
        }
      };

      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data) as unknown;
          if (!parsed || typeof parsed !== 'object') return;
          const event = parsed as Partial<StreamEvent>;
          const eventType = typeof event.type === 'string' ? event.type : null;
          if (eventType === 'control') {
            useTelemetryStore.setState({ bridgeStatus: 'connected', lastTickAt: Date.now() });
            lastEventTs = Date.now();
            return;
          }
          if (!eventType) {
            return;
          }
          lastEventTs = Date.now();
          const store = useTelemetryStore.getState();
          store.ingestEvent({ type: eventType, payload: event.payload });
        } catch {
          /* ignore parse errors */
        }
      };

      es.onerror = (errorEvent) => {
        console.warn('Telemetry feed error:', errorEvent);
        es.close();
        source = null;
        useTelemetryStore.setState({ bridgeStatus: 'disconnected' });
        if (active) {
          const backoffDelay = backoffRef.current;
          reconnectTimeoutRef.current = setTimeout(connect, backoffDelay);
          backoffRef.current = Math.min(backoffRef.current * 1.5, MAX_BACKOFF_MS);
        }
      };
    };

    // Start with mock data, fallback to live stream
    loadMockData();

    return () => {
      active = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (source) {
        source.close();
        source = null;
      }
      useTelemetryStore.setState({ bridgeStatus: 'disconnected' });
    };
  }, [url]);
}
