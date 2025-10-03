'use client';

import { useEffect, useRef, useState } from 'react';

export function useEventStream<T = unknown>(url = '/api/stream') {
  const [last, setLast] = useState<T | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let active = true;

    const connect = () => {
      if (!active) return;
      const es = new EventSource(url);
      esRef.current = es;
      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as T;
          setLast(parsed);
        } catch {
          /* ignore malformed frames */
        }
      };
      es.onerror = () => {
        es.close();
        if (active) {
          setTimeout(connect, 1000);
        }
      };
    };

    connect();

    return () => {
      active = false;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [url]);

  return last;
}
