import { useEffect } from 'react';

export type StreamHandlers = {
  onTick?: (payload: unknown) => void;
  onFill?: (payload: unknown) => void;
  onControl?: (payload: unknown) => void;
};

export function useLiveStream(enabled: boolean, handlers: StreamHandlers) {
  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource('/api/stream');
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { type?: string; payload?: unknown };
        if (msg.type === 'tick' && handlers.onTick) handlers.onTick(msg.payload);
        else if (msg.type === 'fill' && handlers.onFill) handlers.onFill(msg.payload);
        else if (msg.type === 'control' && handlers.onControl) handlers.onControl(msg.payload);
      } catch {}
    };
    return () => es.close();
  }, [enabled, handlers]);
}
