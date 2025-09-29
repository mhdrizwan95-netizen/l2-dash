import { NextRequest } from 'next/server';
import { bus } from '@/lib/bus';
export const runtime = 'nodejs';
const PING_MS = 15000;
export async function GET(req: NextRequest) {
const encoder = new TextEncoder();
let aborted = false; let pingTimer: NodeJS.Timer | null = null; let unsub: (()=>void) | null = null;
const stream = new ReadableStream<Uint8Array>({
start(controller){
const cleanup=()=>{ if(pingTimer){clearInterval(pingTimer); pingTimer=null;} if(unsub){ try{unsub();}catch{} unsub=null;} try{controller.close();}catch{} };
const send=(d:any)=>{ if(aborted) return; try{ controller.enqueue(encoder.encode(`data: ${JSON.stringify(d)}\n\n`)); } catch { aborted=true; cleanup(); } };
send({ type:'control', payload:{ hello:true, ts:Date.now() } });
unsub = bus.subscribe((e:any)=>send(e));
pingTimer=setInterval(()=>send({ type:'control', payload:{ ping:Date.now() } }), PING_MS);
req.signal.addEventListener('abort', ()=>{ if(aborted) return; aborted=true; cleanup(); });
},
cancel(){ aborted=true; },
});
return new Response(stream, { headers:{ 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache, no-transform', Connection:'keep-alive', 'X-Accel-Buffering':'no' } });
}
