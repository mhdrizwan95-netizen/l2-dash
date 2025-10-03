import { create } from 'zustand';
import { brokerClient } from './brokerClient';

interface CockpitState {
  tradingEnabled: boolean;
  focusedSymbol: string | null;
  actions: {
    kill: () => Promise<void>;
    flatten: () => Promise<void>;
    reconnect: () => void;
    toggleMode: () => void;
    setFocusedSymbol: (symbol: string | null) => void;
  };
}

export const useCockpitStore = create<CockpitState>((set, get) => ({
  tradingEnabled: true, // Default enabled for dev
  focusedSymbol: null,

  actions: {
    kill: async () => {
      const { tradingEnabled } = get();
      if (!tradingEnabled) {
        console.log('[COCKPIT] Kill blocked - trading already disabled');
        return;
      }

      try {
        console.log('[COCKPIT] Kill switch activated - flattening all positions and disabling trading');

        // Flatten all positions
        await brokerClient.flattenAll();

        // Disable trading after flatten
        set({ tradingEnabled: false });

        console.log('[COCKPIT] Kill complete - trading disabled');
      } catch (error) {
        console.error('[COCKPIT] Kill failed:', error);
        throw error; // Re-throw to handle in UI
      }
    },

    flatten: async () => {
      const { tradingEnabled } = get();
      if (!tradingEnabled) {
        console.log('[COCKPIT] Flatten blocked - trading disabled');
        return;
      }

      try {
        console.log('[COCKPIT] Flattening all positions');

        await brokerClient.flattenAll();

        console.log('[COCKPIT] All positions flattened');
      } catch (error) {
        console.error('[COCKPIT] Flatten failed:', error);
        throw error; // Re-throw to handle in UI
      }
    },

    reconnect: () => {
      console.log('[COCKPIT] Reconnect requested');
      // TODO: Implement global SSE reconnection
      // For now, we'll trigger a page reload if SSE connection is broken
      // This should be replaced with proper SSE client reconnection
      if (confirm('Force page reload to reconnect systems?')) {
        window.location.reload();
      }
    },

    toggleMode: () => {
      console.log('[COCKPIT] Mode toggle requested');
      // Simple toggle of trading enabled state for emergency control
      set((state) => ({ tradingEnabled: !state.tradingEnabled }));
    },

    setFocusedSymbol: (symbol: string | null) => {
      set({ focusedSymbol: symbol });
      console.log(`[WATCHLIST] Symbol focus changed to: ${symbol || 'none'}`);
    },
  },
}));

// Actions for easy access
export const cockpitActions = {
  kill: () => useCockpitStore.getState().actions.kill().catch(console.error),
  flatten: () => useCockpitStore.getState().actions.flatten().catch(console.error),
  reconnect: () => useCockpitStore.getState().actions.reconnect(),
  toggleMode: () => useCockpitStore.getState().actions.toggleMode(),
  setFocusedSymbol: (symbol: string | null) => useCockpitStore.getState().actions.setFocusedSymbol(symbol),
};
