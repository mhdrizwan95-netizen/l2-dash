'use client';
import { StrategyFile } from '@/hooks/useStrategies';

export function ParamsForm({
  file,
  values,
  onChange,
}: {
  file: StrategyFile;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const getValue = (key: string): unknown => values[key] ?? file.defaults[key];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {(file.schema ?? []).map((f) => {
        if (f.type === 'number') {
          const current = getValue(f.key);
          const inputValue = typeof current === 'number' ? current : '';
          return (
            <label key={f.key} className="text-sm">
              {f.label}
              <input
                type="number"
                min={f.min ?? undefined}
                max={f.max ?? undefined}
                step={f.step ?? 1}
                value={inputValue}
                onChange={(e) => onChange(f.key, e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-1 w-full bg-zinc-800 rounded-lg p-2"
              />
            </label>
          );
        }
        if (f.type === 'boolean') {
          const current = getValue(f.key);
          return (
            <label key={f.key} className="text-sm inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(current)}
                onChange={(e) => onChange(f.key, e.target.checked)}
              />
              {f.label}
            </label>
          );
        }
        if (f.type === 'select') {
          const current = getValue(f.key);
          const value = typeof current === 'string' ? current : '';
          return (
            <label key={f.key} className="text-sm">
              {f.label}
              <select
                value={value}
                onChange={(e) => onChange(f.key, e.target.value)}
                className="mt-1 w-full bg-zinc-800 rounded-lg p-2"
              >
                {f.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
          );
        }
        return null;
      })}
    </div>
  );
}
