// src/lib/bus.ts
type Listener<T = any> = (event: T) => void;

class EventBus {
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  publish(event: any) {
    for (const fn of this.listeners) {
      try { fn(event); } catch (err) { console.error('[bus] listener error:', err); }
    }
  }
}

export const bus = new EventBus();
