import type { Layout, Layouts } from 'react-grid-layout';

function toFiniteInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  return null;
}

function sanitizeLayoutItem(raw: unknown): Layout | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const id = typeof record.i === 'string' ? record.i : null;
  const x = toFiniteInteger(record.x);
  const y = toFiniteInteger(record.y);
  const w = toFiniteInteger(record.w);
  const h = toFiniteInteger(record.h);
  if (!id || x === null || y === null || w === null || h === null) {
    return null;
  }
  const item: Layout = { i: id, x, y, w, h };

  const minW = toFiniteInteger(record.minW);
  if (minW !== null) item.minW = minW;
  const maxW = toFiniteInteger(record.maxW);
  if (maxW !== null) item.maxW = maxW;
  const minH = toFiniteInteger(record.minH);
  if (minH !== null) item.minH = minH;
  const maxH = toFiniteInteger(record.maxH);
  if (maxH !== null) item.maxH = maxH;

  const moved = toBoolean(record.moved);
  if (moved !== null) item.moved = moved;
  const isStatic = toBoolean(record.static);
  if (isStatic !== null) item.static = isStatic;
  const isDraggable = toBoolean(record.isDraggable);
  if (isDraggable !== null) item.isDraggable = isDraggable;
  const isResizable = toBoolean(record.isResizable);
  if (isResizable !== null) item.isResizable = isResizable;

  const resizeHandles = record.resizeHandles;
  if (Array.isArray(resizeHandles) && resizeHandles.every((handle) => typeof handle === 'string')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item.resizeHandles = [...resizeHandles] as any;
  }

  return item;
}

export function sanitizeLayouts(input: unknown): Layouts | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const record = input as Record<string, unknown>;
  const sanitized: Layouts = {};
  let totalItems = 0;
  for (const [breakpoint, value] of Object.entries(record)) {
    if (!Array.isArray(value)) {
      continue;
    }
    const items: Layout[] = [];
    for (const rawItem of value) {
      const item = sanitizeLayoutItem(rawItem);
      if (item) {
        items.push(item);
      }
    }
    sanitized[breakpoint] = items;
    totalItems += items.length;
  }
  if (totalItems === 0 && Object.keys(sanitized).length === 0) {
    return null;
  }
  return sanitized;
}

export function cloneLayouts(layouts: Layouts): Layouts {
  return JSON.parse(JSON.stringify(layouts)) as Layouts;
}

export type { Layout, Layouts };
