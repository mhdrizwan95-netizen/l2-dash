import type { NextRequest } from 'next/server';
import type { ControlCommand } from '@/lib/controlTypes';

export const runtime = 'edge';

interface WsState {
  clients: Set<WebSocket>;
  last: ControlCommand | null;
}

const GLOBAL_KEY = '__l2dash_control_ws__';

function getGlobalState(): WsState {
  const globalScope = globalThis as typeof globalThis & { [GLOBAL_KEY]?: WsState };
  if (!globalScope[GLOBAL_KEY]) {
    globalScope[GLOBAL_KEY] = { clients: new Set<WebSocket>(), last: null };
  }
  return globalScope[GLOBAL_KEY] as WsState;
}

function broadcast(state: WsState, data: unknown) {
  const payload = JSON.stringify(data);
  for (const client of state.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

async function fetchLastCommand(request: NextRequest): Promise<ControlCommand | null> {
  try {
    const url = new URL('/api/control/last', request.url);
    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as { last?: ControlCommand };
    return json.last ?? null;
  } catch {
    return null;
  }
}

export function GET(request: NextRequest) {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('Expected WebSocket upgrade', { status: 426 });
  }

  // @ts-expect-error Deno namespace is available in the Edge runtime
  const { socket, response } = Deno.upgradeWebSocket(request);

  const state = getGlobalState();

  socket.addEventListener('open', async () => {
    state.clients.add(socket);
    if (!state.last) {
      state.last = await fetchLastCommand(request);
    }
    if (state.last) {
      socket.send(JSON.stringify({ type: 'cache', payload: state.last }));
    }
  });

  socket.addEventListener('message', async (event: MessageEvent) => {
    try {
      const payload = typeof event.data === 'string' ? JSON.parse(event.data) : null;
      if (!payload || typeof payload !== 'object') {
        return;
      }
      const response = await fetch(new URL('/api/control/dispatch', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const json = (await response.json()) as { command: ControlCommand };
        state.last = json.command;
        broadcast(state, { type: 'event', payload: json.command });
      } else {
        socket.send(JSON.stringify({ type: 'error', status: response.status }));
      }
    } catch {
      socket.send(JSON.stringify({ type: 'error', status: 500 }));
    }
  });

  const cleanup = () => {
    state.clients.delete(socket);
  };

  socket.addEventListener('close', cleanup);
  socket.addEventListener('error', cleanup);

  return response;
}
