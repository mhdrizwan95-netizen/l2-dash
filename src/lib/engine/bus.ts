export type BusEvent =
  | { type: 'tick'; payload: any }
  | { type: 'fill'; payload: any }
  | { type: 'control'; payload: any };

class EventBus {
  private listeners = new Set<(e: BusEvent) => void>();
  subscribe(fn: (e: BusEvent) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  publish(e: BusEvent) {
    for (const fn of this.listeners) fn(e);
  }
}
export const bus = new EventBus();
