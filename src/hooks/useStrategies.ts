'use client';
import { useEffect, useState } from 'react';

export type StrategyFile = {
  id: string;
  name: string;
  kind: string;
  defaults: Record<string, any>;
  schema: Array<
    | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number }
    | { key: string; label: string; type: 'boolean' }
    | { key: string; label: string; type: 'select'; options: Array<{ value: string; label: string }> }
  >;
};

export function useStrategies() {
  const [list, setList] = useState<StrategyFile[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/strategies', { cache: 'no-store' });
        const json = await res.json();
        if (!alive) return;
        setList(json.strategies || []);
      } catch {
        if (!alive) return;
        setList([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { strategies: list ?? [], loading };
}
