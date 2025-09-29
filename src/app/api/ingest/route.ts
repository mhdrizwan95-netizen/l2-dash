import { NextRequest } from 'next/server';
import { bus } from '@/lib/bus';
import { markovBySymbol } from '@/lib/markov';

export const runtime = 'nodejs';
const EXPECTED_KEY = process.env.INGEST_KEY || '';

export async function POST(req: NextRequest) {
const key = req.headers.get('x-ingest-key') || '';
if (EXPECTED_KEY && key !== EXPECTED_KEY) {
return Response.json({ ok:false, error:'unauthorized' }, { status: 401 });
}
const body = await req.json().catch(()=>null);
if (!body || typeof body.symbol !== 'string' || typeof body.price !== 'number') {
return Response.json({ ok:false, error:'bad-payload' }, { status:400 });
}
const { symbol, price, ts = Date.now() } = body;
bus.publish({ type:'tick', payload:{ symbol, price, ts } });
const mk = markovBySymbol(symbol);
mk.observe(mk.lastPrice ?? price, price);
mk.lastPrice = price;
mk.maybePublish();
return Response.json({ ok:true });
}
