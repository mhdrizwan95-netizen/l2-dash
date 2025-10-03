/**
 * Cockpit persistence utilities with namespaced localStorage keys
 * Format: `cockpit:v1:{tab}`
 */

let saveTimeout: NodeJS.Timeout | null = null;

export function saveLocal(key: string, data: unknown): void {
  // Debounce saves to avoid excessive localStorage writes
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn(`Failed to save to localStorage for key "${key}":`, error);
    }
  }, 200);
}

export function loadLocal<T = unknown>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.warn(`Failed to load from localStorage for key "${key}":`, error);
    return null;
  }
}

// Clamp panel sizes to ensure they stay within acceptable bounds
export function clampPanelSizes(sizes: number[], constraints: { minSize: number; maxSize?: number }[]): number[] {
  const clamped = sizes.map((size, index) => {
    const constraint = constraints[index] || { minSize: 10 };
    const minSize = constraint.minSize;
    const maxSize = constraint.maxSize || 90;
    return Math.max(minSize, Math.min(maxSize, size));
  });

  // Renormalize to sum to ~100% to prevent overflow/underflow
  const total = clamped.reduce((sum, size) => sum + size, 0);
  if (total > 100) {
    return clamped.map(size => (size / total) * 100);
  }

  return clamped;
}

// Helper to get panel constraints for cockpit panels
export function getCockpitConstraints(): { minSize: number; maxSize?: number }[] {
  // Vertical: Top, Middle, Bottom
  return [
    { minSize: 12, maxSize: 25 },  // Top
    { minSize: 45, maxSize: 75 },  // Middle
    { minSize: 12, maxSize: 30 }   // Bottom
  ];
}

// Helper to get horizontal panel constraints
export function getHorizontalConstraints(): { minSize: number; maxSize?: number }[] {
  // Horizontal: Left, Center, Right
  return [
    { minSize: 18, maxSize: 30 },  // Left
    { minSize: 44, maxSize: 64 },  // Center
    { minSize: 18, maxSize: 30 }   // Right
  ];
}

// Helper to construct cockpit keys
export function getCockpitKey(tab: string): string {
  return `cockpit:v2:${tab}`;
}
