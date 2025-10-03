import { unstable_batchedUpdates } from 'react-dom';

type PatchFn<T> = (prev: T) => Partial<T>;

export function makeRafBatcher<T>(apply: (p: Partial<T>) => void) {
  let queued: Partial<T> | null = null;
  let raf = 0;

  const flush = () => {
    raf = 0;
    if (!queued) return;
    const p = queued;
    queued = null;
    // ensure React batches any state updates triggered by this apply
    unstable_batchedUpdates(() => apply(p));
  };

  return (patch: Partial<T>) => {
    // shallow-merge patches within the same frame
    queued = { ...(queued || {}), ...patch };
    if (!raf) raf = requestAnimationFrame(flush);
  };
}
