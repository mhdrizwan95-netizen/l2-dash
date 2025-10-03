import { useMemo } from 'react';

/**
 * Reusable layout hook that provides shrinkable, centered layouts
 * Prevents horizontal overflow, gutter drift, and ensures responsive centering
 */
export function useLayoutScaffold(options: {
  columns?: string[];
  maxWidth?: number;
  padding?: number;
} = {}) {
  const {
    columns = ['minmax(240px, 320px)', 'minmax(0, 1fr)', 'minmax(260px, 380px)'],
    maxWidth = 1600,
    padding = 32
  } = options;

  const containerClass = useMemo(() =>
    `h-full w-full min-h-0 min-w-0 overflow-hidden px-${Math.round(padding / 4)}`.replace('--', ''),
    [padding]
  );

  const gridClass = useMemo(() =>
    [
      'mx-auto',
      `max-w-[${maxWidth}px]`,
      'grid gap-4',
      `grid-cols-[${columns.join('_')}]`
    ].join(' '),
    [maxWidth, columns]
  );

  const itemClass = 'min-w-0';

  return { containerClass, gridClass, itemClass };
}
