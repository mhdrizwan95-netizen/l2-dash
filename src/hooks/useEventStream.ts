'use client';
import { useEffect, useRef, useState } from 'react';

export function useEventStream<T = any>(url = '/api/stream') {
const [last, setLast] = useState<T | null>(null);
const esRef = useRef<EventSource | null>(null);
useEffect(() => {
let active = true;
const connect = () => {
if (!active) return;
const es = new EventSource(url);
esRef.current = es;
es.onmessage = (ev) => { try { setLast(JSON.parse(ev.data)); } catch {} };
es.onerror = () => { es.close(); setTimeout(connect, 1000); };
};
connect();
return () => { active = false; esRef.current?.close(); };
}, [url]);
return last;
}
