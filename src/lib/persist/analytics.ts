/**
 * Analytics dashboard persistence utilities with namespaced localStorage keys
 * Format: `dash:v2:{mode}:{tab}` or `dash:v2:{mode}:{tab}:{symbol}`
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

// Helper to construct analytics keys with optional symbol inclusion
export function getAnalyticsKey(mode: string, tab: string, symbol?: string): string {
  const base = `dash:v2:${mode}:${tab}`;
  const includeSymbol = loadLocal("dash:v2:settings:includeSymbol") ?? false;
  return symbol && includeSymbol ? `${base}:${symbol}` : base;
}

// Handle symbol inclusion setting
export function setIncludeSymbol(include: boolean): void {
  saveLocal("dash:v2:settings:includeSymbol", include);
}
