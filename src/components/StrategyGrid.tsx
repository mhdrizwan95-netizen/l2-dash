'use client';
import { StrategyCard } from '@/components/StrategyCard';
import { useStrategyStore } from '@/lib/strategyStore';

export function StrategyGrid() {
const strategies = useStrategyStore(s=>s.strategies);
const add = useStrategyStore(s=>s.addStrategy);
const canAdd = strategies.length < 5;
return (
<div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
{strategies.map(s => (
<StrategyCard key={s.id} strat={s}/>
))}
{canAdd && (
<button onClick={()=>add()} className="h-[340px] border border-dashed rounded-2xl grid place-items-center bg-zinc-900/40 hover:bg-zinc-900/60">
<div className="text-zinc-400">+ Add Strategy Slot</div>
</button>
)}
</div>
);
}
