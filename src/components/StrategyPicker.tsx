'use client';
import { useStrategies } from '@/hooks/useStrategies';

export function StrategyPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const { strategies, loading } = useStrategies();
  return (
    <div className="flex items-center gap-2">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="bg-zinc-800 rounded-lg p-2 text-sm"
        disabled={loading}
      >
        <option value="">{loading ? 'Loading…' : 'Select strategy…'}</option>
        {strategies.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    </div>
  );
}
