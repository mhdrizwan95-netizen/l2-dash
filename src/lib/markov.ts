import { bus } from '@/lib/bus';
function stateFromDelta(dp: number, flatEps = 1e-6): 0|1|2 { if (dp>flatEps) return 2; if (dp<-flatEps) return 0; return 1; }
class Markov3 { counts = new Uint32Array(9); lastState: 0|1|2 | null = null; lastEmit = 0; lastPrice: number | null = null;
observe(prev:number,curr:number){ const s=stateFromDelta(curr-prev); if(this.lastState!==null){ this.counts[this.lastState*3+s]++; } this.lastState=s; }
probs(){ const P=[[0,0,0],[0,0,0],[0,0,0]]; for(let r=0;r<3;r++){ const b=r*3; const a=this.counts[b],c=this.counts[b+1],d=this.counts[b+2]; const sum=a+c+d; if(sum){P[r][0]=a/sum;P[r][1]=c/sum;P[r][2]=d/sum;} } return P; }
next(){ if(this.lastState===null) return null as any; const P=this.probs(); return [P[this.lastState][0],P[this.lastState][1],P[this.lastState][2]] as [number,number,number]; }
snapshot(symbol:string){ return { symbol, counts:Array.from(this.counts), P:this.probs(), lastState:this.lastState, next:this.next(), ts:Date.now() }; }
maybePublish(interval=1000,symbol='SYM'){ const now=Date.now(); if(now-this.lastEmit>=interval){ this.lastEmit=now; bus.publish({ type:'markov', payload:this.snapshot(symbol) }); } }
}
const reg = new Map<string, Markov3>();
export function markovBySymbol(symbol:string){ let m=reg.get(symbol); if(!m){ m=new Markov3(); reg.set(symbol,m);} (m as any).maybePublish=(i=1000)=>m!.maybePublish(i,symbol); return m!; }
