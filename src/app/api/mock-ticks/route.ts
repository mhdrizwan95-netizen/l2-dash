import { NextRequest } from 'next/server';
import { bus } from '@/lib/bus';
import { markov } from '@/lib/markov'; // will create below

export const runtime = 'nodejs';

let tickTimer: NodeJS.Timer | null = null;

export async function POST(req: NextRequest) {
  const { cmd } = await req.json().catch(() => ({ cmd: 'start' }));

  if (cmd === 'start') {
    if (!tickTimer) {
      let p = 100;
      tickTimer = setInterval(() => {
        // simple random walk
        const dp = (Math.random() - 0.5) * 0.2; // ~±10 bps
        const prev = p;
        p = +(p + dp).toFixed(4);

        // update Markov
        markov.observe(prev, p);

        // broadcast tick + latest markov snapshot
        bus.publish({ type: 'tick', payload: { ts: Date.now(), price: p } });

        // throttle markov snapshot to ~1/sec
        markov.maybePublish();
      }, 250);
    }
    return Response.json({ ok: true, running: true });
  }

  if (cmd === 'stop') {
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
    return Response.json({ ok: true, running: false });
  }

  return Response.json({ ok: false, error: 'unknown-cmd' }, { status: 400 });
}
