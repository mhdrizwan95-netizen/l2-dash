'use client';
import { useEffect, useState } from 'react';

export type StrategyFile = {
  id: string;
  name: string;
  kind: string;
  defaults: Record<string, unknown>;
  schema: Array<
    | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number }
    | { key: string; label: string; type: 'boolean' }
    | { key: string; label: string; type: 'select'; options: Array<{ value: string; label: string }> }
  >;
};

function normalizeStrategies(input: unknown): StrategyFile[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id : null;
      if (!id) return null;
      const name = typeof record.name === 'string' ? record.name : id;
      const kind = typeof record.kind === 'string' ? record.kind : 'generic';
      const defaults = record.defaults && typeof record.defaults === 'object' ? (record.defaults as Record<string, unknown>) : {};
      const schema = Array.isArray(record.schema) ? (record.schema as StrategyFile['schema']) : [];
      return { id, name, kind, defaults, schema } satisfies StrategyFile;
    })
    .filter((entry): entry is StrategyFile => Boolean(entry));
}

export function useStrategies() {
  const [list, setList] = useState<StrategyFile[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/strategies', { cache: 'no-store' });
        const json = (await res.json()) as unknown;
        if (!alive) return;
        const strategies = json && typeof json === 'object' ? normalizeStrategies((json as { strategies?: unknown }).strategies) : [];
        setList(strategies);
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
