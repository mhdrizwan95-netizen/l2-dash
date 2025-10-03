'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ControlCommand, ControlCommandKind } from '@/lib/controlTypes';
import { useTelemetryStore } from '@/lib/telemetryStore';

export type ControlChannelStatus = 'connecting' | 'open' | 'closed' | 'error';

export interface ControlRequest {
  kind: ControlCommandKind;
  payload?: Record<string, unknown>;
  ts?: number;
  source?: string;
}

const MAX_BACKOFF_MS = 15_000;
const INITIAL_BACKOFF_MS = 1_000;

export function useControlChannel() {
  const [status, setStatus] = useState<ControlChannelStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef<number>(INITIAL_BACKOFF_MS);
  const queueRef = useRef<string[]>([]);

  const flushQueue = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    while (queueRef.current.length) {
      const message = queueRef.current.shift();
      if (message) {
        socket.send(message);
      }
    }
  }, []);

  const handleCommand = useCallback((command: ControlCommand) => {
    useTelemetryStore.getState().ingestEvent({ type: 'control', payload: command });
  }, []);

  const connect = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      return;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setStatus('connecting');
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/api/control`);
    socketRef.current = ws;

    ws.onopen = () => {
      setStatus('open');
      backoffRef.current = INITIAL_BACKOFF_MS;
      flushQueue();
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as { type?: string; payload?: unknown };
        if (!parsed || typeof parsed !== 'object') {
          return;
        }
        if (parsed.type === 'event' || parsed.type === 'cache') {
          const payload = parsed.payload as ControlCommand | undefined;
          if (payload && typeof payload === 'object' && typeof payload.kind === 'string') {
            handleCommand(payload);
          }
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    const attemptReconnect = () => {
      if (retryTimerRef.current) {
        return;
      }
      const delay = backoffRef.current;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        connect();
      }, delay);
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
    };

    ws.onclose = () => {
      setStatus('closed');
      attemptReconnect();
    };

    ws.onerror = () => {
      setStatus('error');
      ws.close();
      attemptReconnect();
    };
  }, [flushQueue, handleCommand]);

  useEffect(() => {
    connect();
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  const sendCommand = useCallback((request: ControlRequest, options?: { queue?: boolean }) => {
    const shouldQueue = options?.queue ?? true;
    const payload = {
      ...request,
      ts: request.ts ?? Date.now(),
      source: request.source ?? 'dashboard',
    };
    const message = JSON.stringify(payload);
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(message);
      return true;
    }
    if (shouldQueue) {
      queueRef.current.push(message);
    }
    connect();
    return false;
  }, [connect]);

  return { status, sendCommand };
}
