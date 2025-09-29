'use client';
import { StrategyFile } from '@/hooks/useStrategies';

export function ParamsForm({
  file,
  values,
  onChange,
}: {
  file: StrategyFile;
  values: Record<string, any>;
  onChange: (k: string, v: any) => void;
}) {
  const v = (k: string) => (values[k] ?? file.defaults[k]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {file.schema.map((f) => {
        if (f.type === 'number') {
          return (
            <label key={f.key} className="text-sm">
              {f.label}
              <input
                type="number"
                min={('min' in f) ? (f as any).min : undefined}
                max={('max' in f) ? (f as any).max : undefined}
                step={('step' in f) ? (f as any).step : 1}
                value={v(f.key)}
                onChange={(e) => onChange(f.key, e.target.value === '' ? '' : Number(e.target.value))}
                className="mt-1 w-full bg-zinc-800 rounded-lg p-2"
              />
            </label>
          );
        }
        if (f.type === 'boolean') {
          return (
            <label key={f.key} className="text-sm inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!v(f.key)}
                onChange={(e) => onChange(f.key, e.target.checked)}
              />
              {f.label}
            </label>
          );
        }
        if (f.type === 'select') {
          return (
            <label key={f.key} className="text-sm">
              {f.label}
              <select
                value={v(f.key)}
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
