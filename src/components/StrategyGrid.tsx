'use client';
import { useStrategyStore } from '@/lib/strategyStore';
import { StrategyCard } from './StrategyCard';

function StrategyGridInner() {
  const slots = useStrategyStore(s => s.slots) || [];
  const addSlot = useStrategyStore(s => s.addSlot);

  const canAdd = slots.length < 5;

  return (
    <div className="space-y-4">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {slots.map(slot => (
          <StrategyCard key={slot.id} slot={slot} />
        ))}
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => addSlot()}
          disabled={!canAdd}
          className={`px-4 py-2 rounded-xl border ${canAdd ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700' : 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'}`}
        >
          {canAdd ? '+ Add Strategy Slot' : 'Max 5 slots'}
        </button>
      </div>
    </div>
  );
}

export default StrategyGridInner;
export { StrategyGridInner as StrategyGrid }; // support both default & named import
