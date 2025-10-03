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

// Helper to construct cockpit keys
export function getCockpitKey(tab: string): string {
  return `cockpit:v1:${tab}`;
}
