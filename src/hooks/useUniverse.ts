'use client';

import { useEffect, useMemo } from 'react';
import { fetchUniverseState, useUniverseStore } from '@/lib/universeStore';

const POLL_INTERVAL_MS = 30_000;

export function useUniverseData() {
  const { data, loading, error, lastFetched, setData, setLoading, setError } = useUniverseStore();

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(initial = false) {
      if (!mounted) return;
      if (initial) setLoading(true);
      try {
        const next = await fetchUniverseState();
        if (mounted) setData(next);
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : 'failed to load universe';
          setError(message);
        }
      } finally {
        if (mounted && initial) setLoading(false);
      }
      if (!mounted) return;
      timer = setTimeout(() => load(false), POLL_INTERVAL_MS);
    }

    load(true);

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [setData, setError, setLoading]);

  const countdowns = useMemo(() => {
    const now = Date.now();
    const nextRefresh = data.nextRefreshTs ? Date.parse(data.nextRefreshTs) : null;
    const nextChurn = data.nextChurnTs ? Date.parse(data.nextChurnTs) : null;
    const lastUpdate = data.ts ? Date.parse(data.ts) : null;
    return {
      nextRefreshMs: nextRefresh ? Math.max(0, nextRefresh - now) : null,
      nextChurnMs: nextChurn ? Math.max(0, nextChurn - now) : null,
      lastUpdatedMs: lastUpdate ? Math.max(0, now - lastUpdate) : (lastFetched ? Math.max(0, now - lastFetched) : null),
    };
  }, [data.nextRefreshTs, data.nextChurnTs, data.ts, lastFetched]);

  return { data, loading, error, countdowns };
}
