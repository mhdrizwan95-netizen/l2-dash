'use client';
import { useMemo, useState } from 'react';
import { useStrategyStore, type StrategySlot } from '@/lib/strategyStore';
import { useEventStream } from '@/hooks/useEventStream';
import { useStrategies } from '@/hooks/useStrategies';
import { StrategyPicker } from './StrategyPicker';
import { ParamsForm } from './ParamsForm';

export function StrategyCard({ slot }: { slot: StrategySlot }) {
  const updateSlot = useStrategyStore(s=>s.updateSlot);
  const removeSlot = useStrategyStore(s=>s.removeSlot);
  const setSlotParam = useStrategyStore(s=>s.setSlotParam);

  const [symInput, setSymInput] = useState('');
  const addSym = () => {
    const s = symInput.trim().toUpperCase();
    if (!s) return;
    if (!slot.symbols.includes(s)) updateSlot(slot.id, { symbols: [...slot.symbols, s] });
    setSymInput('');
  };
  const delSym = (sym: string) => updateSlot(slot.id, { symbols: slot.symbols.filter(x => x !== sym) });

  const evt = useEventStream<any>('/api/stream');
  const markov = useMemo(() => (evt?.type === 'markov' ? evt.payload : null), [evt]);

  const { strategies } = useStrategies();
  const file = strategies.find(s => s.id === slot.strategyId) || null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm uppercase tracking-wider text-zinc-400">Strategy</div>
          <div className="text-lg font-semibold">{slot.title}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => updateSlot(slot.id, { running: !slot.running })}
            className={`px-3 py-1.5 rounded-lg ${slot.running ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
          >
            {slot.running ? 'Stop' : 'Start'}
          </button>
          <button onClick={() => removeSlot(slot.id)} className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700">Remove</button>
        </div>
      </div>

      <div className="px-4 pb-3">
        <StrategyPicker
          value={slot.strategyId}
          onChange={(id) => updateSlot(slot.id, { strategyId: id, paramOverrides: {} })}
        />
      </div>

      <div className="px-4 flex flex-wrap items-center gap-2 mb-3">
        {slot.symbols.map(sym => (
          <span key={sym} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-zinc-800 text-sm">
            {sym}
            <button onClick={()=>delSym(sym)} className="text-zinc-400 hover:text-rose-400">×</button>
          </span>
        ))}
        <input
          value={symInput}
          onChange={e=>setSymInput(e.target.value)}
          onKeyDown={(e)=>{ if(e.key==='Enter') addSym(); }}
          placeholder="Add symbol"
          className="bg-zinc-800 rounded-lg p-2 text-sm"
        />
        <button onClick={addSym} className="px-2 py-1 rounded-lg bg-zinc-700 text-sm">Add</button>
      </div>

      {file ? (
        <div className="px-4 pb-4">
          <ParamsForm
            file={file}
            values={slot.paramOverrides}
            onChange={(k, v) => setSlotParam(slot.id, k, v)}
          />
          <div className="mt-2 text-xs text-zinc-500">
            Running <span className="font-mono">{file.name}</span> with per-slot overrides.
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4 text-sm text-zinc-500">Pick a strategy to edit parameters.</div>
      )}

      <div className="px-4 pb-4">
        <div className="text-xs text-zinc-400 mb-2">Live odds{slot.symbols.length?` for ${slot.symbols[0]}`:''}</div>
        {markov?.symbol && slot.symbols.includes(markov.symbol) && markov.next ? (
          <div className="grid grid-cols-3 gap-2">
            {(['Down','Flat','Up'] as const).map((label, i) => (
              <div key={label} className={`rounded-lg p-2 ${i===maxIndex(markov.next)?'bg-emerald-600/20 border border-emerald-600/40':'bg-zinc-800'}`}>
                <div className="text-xs text-zinc-400">{label}</div>
                <div className="text-lg font-semibold">{(markov.next[i]*100).toFixed(1)}%</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-zinc-500 text-sm">Waiting for data…</div>
        )}
      </div>

      <div className="px-4 pb-4 grid grid-cols-4 gap-3 text-sm">
        <Metric label="PnL" value={fmtMoney(slot.report.pnl)} />
        <Metric label="Win %" value={fmtPct(slot.report.winRate)} />
        <Metric label="# Trades" value={String(slot.report.trades)} />
        <Metric label="Max DD" value={fmtPct(slot.report.maxDD)} />
      </div>
    </div>
  );
}

function Metric({label, value}:{label:string; value:string}){
  return (
    <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
function fmtMoney(x:number){ return (x>=0?'+':'') + x.toFixed(2); }
function fmtPct(x:number){ return isFinite(x)? (x*100).toFixed(1)+'%':'—'; }
function maxIndex(a:number[]){ let mi=0; for(let i=1;i<a.length;i++) if(a[i]>a[mi]) mi=i; return mi; }
