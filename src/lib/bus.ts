// src/lib/bus.ts

export type BusEvent = {
  type: string;
  payload?: unknown;
};

type Listener<T> = (event: T) => void;

class EventBus<TEvent extends BusEvent = BusEvent> {
  private listeners = new Set<Listener<TEvent>>();

  subscribe(listener: Listener<TEvent>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(event: TEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[bus] listener error:', error);
      }
    }
  }
}

export const bus = new EventBus();
