import { NextRequest } from 'next/server';
import { bus } from '@/lib/bus';

export const runtime = 'nodejs';

const PING_MS = 15_000;

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let aborted = false;
  let pingTimer: NodeJS.Timeout | null = null;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const cleanup = () => {
        if (pingTimer) {
          clearInterval(pingTimer);
          pingTimer = null;
        }
        if (unsubscribe) {
          try {
            unsubscribe();
          } catch {
            /* ignore */
          }
          unsubscribe = null;
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      };

      const send = (event: unknown) => {
        if (aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          aborted = true;
          cleanup();
        }
      };

      send({ type: 'control', payload: { hello: true, ts: Date.now() } });

      unsubscribe = bus.subscribe((event) => send(event));
      pingTimer = setInterval(() => send({ type: 'control', payload: { ping: Date.now() } }), PING_MS);

      req.signal.addEventListener('abort', () => {
        if (aborted) return;
        aborted = true;
        cleanup();
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
