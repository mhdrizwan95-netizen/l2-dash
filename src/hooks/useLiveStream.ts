import { useEffect } from 'react';

export type StreamHandlers = {
  onTick?: (p: any) => void;
  onFill?: (p: any) => void;
  onControl?: (p: any) => void;
};

export function useLiveStream(enabled: boolean, handlers: StreamHandlers) {
  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource('/api/stream');
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'tick' && handlers.onTick) handlers.onTick(msg.payload);
        else if (msg.type === 'fill' && handlers.onFill) handlers.onFill(msg.payload);
        else if (msg.type === 'control' && handlers.onControl) handlers.onControl(msg.payload);
      } catch {}
    };
    return () => es.close();
  }, [enabled]);
}
