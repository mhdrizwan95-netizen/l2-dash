/**
 * Layout clamping utilities to prevent black screen bugs
 * Ensures panels never collapse below useful minimum sizes
 */

// Default cockpit panel sizes and constraints
export const COCKPIT_DEFAULTS = {
  topBar: 10,
  middle: 60,
  bottom: 22,
  bottomBar: 8,
  leftWatchlist: 25,
  center: 50,
  rightMicrocharts: 25,
  tape: 50,
  ordersFillsPositions: 50,
} as const;

export const COCKPIT_MIN_SIZES = {
  topBar: 5,
  middle: 30,
  bottom: 15,
  bottomBar: 5,
  leftWatchlist: 15,
  center: 30,
  rightMicrocharts: 15,
  tape: 30,
  ordersFillsPositions: 30,
} as const;

// Default analytics card minimum heights (in viewport units)
export const ANALYTICS_DEFAULT_MIN_HEIGHTS = {
  pnldistribution: 200,
  tradeoutcome: 200,
  statereturns: 200,
  sharpetrends: 150,
  strategycomparisons: 200,
  marketregimes: 150,
  drawdownanalysis: 200,
  expectancycalculator: 200,
} as const;

// Clamp cockpit panel sizes to prevent zero-height panels
export function clampCockpitSizes(
  layout: Partial<Record<keyof typeof COCKPIT_DEFAULTS, number>>
): Record<keyof typeof COCKPIT_DEFAULTS, number> {
  const clamped: Record<keyof typeof COCKPIT_DEFAULTS, number> = { ...COCKPIT_DEFAULTS };

  Object.keys(COCKPIT_DEFAULTS).forEach(key => {
    const layoutKey = key as keyof typeof COCKPIT_DEFAULTS;
    const persisted = layout[layoutKey];
    if (persisted !== undefined) {
      clamped[layoutKey] = Math.max(COCKPIT_MIN_SIZES[layoutKey], persisted);
    }
  });

  return clamped;
}

// Clamp analytics grid sizes to prevent cards from becoming unusable
export function clampAnalyticsSizes(
  layout: Partial<Record<string, number>>
): Record<string, number> {
  const clamped: Record<string, number> = { ...layout } as Record<string, number>;

  Object.entries(clamped).forEach(([key, value]) => {
    // Convert key to lowercase for lookup
    const minHeightKey = key.toLowerCase().replace(/[^a-z]/g, '') as keyof typeof ANALYTICS_DEFAULT_MIN_HEIGHTS;
    const minHeight = ANALYTICS_DEFAULT_MIN_HEIGHTS[minHeightKey] || 150; // Default 150px min height
    clamped[key] = Math.max(minHeight, value);
  });

  return clamped;
}

import { loadLocal as cockpitLoadLocal, getCockpitKey } from './cockpit';
import { loadLocal as analyticsLoadLocal, getAnalyticsKey } from './analytics';

// Get clamped layout on load - merges defaults with persisted, applies clamping
export function getClampedCockpitLayout(tab: string): Record<keyof typeof COCKPIT_DEFAULTS, number> {
  const persisted = cockpitLoadLocal(getCockpitKey(tab));
  return clampCockpitSizes(persisted ?? {});
}

// Get clamped analytics layout on load
export function getClampedAnalyticsLayout(mode: string, tab: string, symbol?: string): Record<string, number> {
  const persisted = analyticsLoadLocal(getAnalyticsKey(mode, tab, symbol));
  return clampAnalyticsSizes(persisted ?? {});
}

// Reset all layout-related localStorage keys and reload
export function resetAllLayouts(): void {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('cockpit:v1:') ||
      key.startsWith('dash:v2:') ||
      key.startsWith('react-resizable-panels')
    )) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
  window.location.reload();
}

// New clamp utilities for layout persistence safety
export function clampLayout(sizes: number[], min = 5, max = 90): number[] {
  if (!Array.isArray(sizes) || sizes.some(n => !Number.isFinite(n))) return [];
  const clamped = sizes.map(n => Math.max(min, Math.min(max, n)));
  const total = clamped.reduce((a, b) => a + b, 0);
  return total > 0 ? clamped.map(n => (n / total) * 100) : [];
}

export function safeArray<T = number>(a: unknown, fallback: T[]): T[] {
  return Array.isArray(a) && a.every((n) => Number.isFinite(n)) ? a : fallback;
}
