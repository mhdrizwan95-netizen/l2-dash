import { create } from 'zustand';
import type { Layouts } from 'react-grid-layout';
import { cloneLayouts } from '@/lib/layoutUtils';

export type TimeRangeId = '5m' | '30m' | '2h' | 'all';

export type TabName = 'overview' | 'portfolio' | 'strategy' | 'execution' | 'reports' | 'universe' | 'analytics' | 'system';

export const OVERVIEW_LAYOUTS: Layouts = {
  lg: [
    // Row 1: PnL Summary, Drawdown, Exposure
    { i: 'overview-pnl', x: 0, y: 0, w: 4, h: 4 },
    { i: 'overview-dd', x: 4, y: 0, w: 2, h: 2 },
    { i: 'overview-exposure', x: 6, y: 0, w: 4, h: 2 },
    { i: 'overview-hmm', x: 10, y: 0, w: 2, h: 2 },
    { i: 'overview-trades', x: 8, y: 2, w: 2, h: 2 },

    // Row 2: System Health, Operations, Symbol Watchlist
    { i: 'overview-health', x: 4, y: 2, w: 2, h: 2 },
    { i: 'overview-control', x: 6, y: 2, w: 2, h: 2 },
    { i: 'overview-watchlist', x: 0, y: 4, w: 4, h: 2 },

    // Row 3: Price History
    { i: 'overview-chart', x: 0, y: 6, w: 12, h: 2 },

    // Additional cards (optional)
    { i: 'overview-detail', x: 4, y: 4, w: 8, h: 2 },
  ],
  md: [
    { i: 'overview-pnl', x: 0, y: 0, w: 4, h: 4 },
    { i: 'overview-dd', x: 0, y: 4, w: 2, h: 2 },
    { i: 'overview-exposure', x: 2, y: 4, w: 2, h: 2 },
    { i: 'overview-hmm', x: 0, y: 6, w: 2, h: 2 },
    { i: 'overview-trades', x: 2, y: 6, w: 2, h: 2 },
    { i: 'overview-health', x: 0, y: 8, w: 2, h: 2 },
    { i: 'overview-control', x: 2, y: 8, w: 2, h: 2 },
    { i: 'overview-watchlist', x: 0, y: 10, w: 4, h: 2 },
    { i: 'overview-chart', x: 0, y: 12, w: 4, h: 2 },
    { i: 'overview-detail', x: 0, y: 14, w: 4, h: 2 },
  ],
  sm: [
    { i: 'overview-pnl', x: 0, y: 0, w: 2, h: 4 },
    { i: 'overview-dd', x: 0, y: 4, w: 1, h: 2 },
    { i: 'overview-exposure', x: 1, y: 4, w: 1, h: 2 },
    { i: 'overview-hmm', x: 0, y: 6, w: 1, h: 2 },
    { i: 'overview-trades', x: 1, y: 6, w: 1, h: 2 },
    { i: 'overview-health', x: 0, y: 8, w: 1, h: 2 },
    { i: 'overview-control', x: 1, y: 8, w: 1, h: 2 },
    { i: 'overview-watchlist', x: 0, y: 10, w: 2, h: 2 },
    { i: 'overview-chart', x: 0, y: 12, w: 2, h: 2 },
    { i: 'overview-detail', x: 0, y: 14, w: 2, h: 2 },
  ],
};

export const PORTFOLIO_LAYOUTS: Layouts = {
  lg: [
    { i: 'portfolio-positions', x: 0, y: 0, w: 6, h: 2 },
    { i: 'portfolio-exposure', x: 6, y: 0, w: 2, h: 2 },
    { i: 'portfolio-pnl-timeline', x: 8, y: 0, w: 4, h: 2 },
    { i: 'portfolio-risk', x: 0, y: 2, w: 4, h: 2 },
    { i: 'portfolio-cash', x: 4, y: 2, w: 4, h: 2 },
  ],
  md: [
    { i: 'portfolio-positions', x: 0, y: 0, w: 8, h: 2 },
    { i: 'portfolio-exposure', x: 0, y: 2, w: 4, h: 2 },
    { i: 'portfolio-pnl-timeline', x: 4, y: 2, w: 4, h: 2 },
    { i: 'portfolio-risk', x: 0, y: 4, w: 4, h: 2 },
    { i: 'portfolio-cash', x: 4, y: 4, w: 4, h: 2 },
  ],
  sm: [
    { i: 'portfolio-positions', x: 0, y: 0, w: 2, h: 2 },
    { i: 'portfolio-exposure', x: 0, y: 2, w: 1, h: 2 },
    { i: 'portfolio-pnl-timeline', x: 1, y: 2, w: 1, h: 2 },
    { i: 'portfolio-risk', x: 0, y: 4, w: 1, h: 2 },
    { i: 'portfolio-cash', x: 1, y: 4, w: 1, h: 2 },
  ],
};

export const STRATEGY_ML_LAYOUTS: Layouts = {
  lg: [
    // Row 1: Active Model, Current State, Transition Matrix, Guardrail Log
    { i: 'strategy-active-model', x: 0, y: 0, w: 2, h: 2 },
    { i: 'strategy-current-state', x: 2, y: 0, w: 2, h: 2 },
    { i: 'strategy-transition-matrix', x: 4, y: 0, w: 4, h: 2 },
    { i: 'strategy-guardrail-log', x: 8, y: 0, w: 4, h: 2 },

    // Row 2: State Occupancy, Live Telemetry, Drift Monitor, Training Metrics
    { i: 'strategy-live-telemetry', x: 0, y: 2, w: 2, h: 2 },
    { i: 'strategy-drift-monitor', x: 2, y: 2, w: 4, h: 2 },
    { i: 'strategy-training-metrics', x: 6, y: 2, w: 4, h: 2 },
    { i: 'strategy-action-timeline', x: 10, y: 2, w: 2, h: 2 },

    // Row 3: Feature Health, Model Provenance, Policy Mapping, State→PnL Matrix
    { i: 'strategy-feature-health', x: 0, y: 4, w: 2, h: 2 },
    { i: 'strategy-model-provenance', x: 2, y: 4, w: 2, h: 2 },
    { i: 'strategy-policy-mapping', x: 4, y: 4, w: 2, h: 2 },
    { i: 'strategy-state-pnl-matrix', x: 6, y: 4, w: 4, h: 2 },
    { i: 'strategy-suggest-exec', x: 10, y: 4, w: 2, h: 2 },

    // Row 4: Timelines
    { i: 'strategy-entropy-timeline', x: 0, y: 6, w: 4, h: 2 },
    { i: 'strategy-inference-latency', x: 8, y: 6, w: 4, h: 2 },
  ],
  md: [
    { i: 'strategy-active-model', x: 0, y: 0, w: 2, h: 2 },
    { i: 'strategy-current-state', x: 2, y: 0, w: 2, h: 2 },
    { i: 'strategy-transition-matrix', x: 4, y: 0, w: 4, h: 2 },
    { i: 'strategy-guardrail-log', x: 0, y: 2, w: 4, h: 2 },
    { i: 'strategy-live-telemetry', x: 0, y: 4, w: 2, h: 2 },
    { i: 'strategy-drift-monitor', x: 2, y: 4, w: 4, h: 2 },
    { i: 'strategy-training-metrics', x: 6, y: 4, w: 2, h: 2 },
    { i: 'strategy-action-timeline', x: 0, y: 6, w: 4, h: 2 },
    { i: 'strategy-feature-health', x: 0, y: 8, w: 2, h: 2 },
    { i: 'strategy-model-provenance', x: 2, y: 8, w: 2, h: 2 },
    { i: 'strategy-policy-mapping', x: 4, y: 8, w: 2, h: 2 },
    { i: 'strategy-state-pnl-matrix', x: 6, y: 8, w: 2, h: 2 },
    { i: 'strategy-suggest-exec', x: 4, y: 6, w: 4, h: 2 },
    { i: 'strategy-entropy-timeline', x: 0, y: 10, w: 4, h: 2 },
    { i: 'strategy-inference-latency', x: 4, y: 10, w: 4, h: 2 },
  ],
  sm: [
    { i: 'strategy-active-model', x: 0, y: 0, w: 1, h: 2 },
    { i: 'strategy-current-state', x: 1, y: 0, w: 1, h: 2 },
    { i: 'strategy-transition-matrix', x: 0, y: 2, w: 2, h: 2 },
    { i: 'strategy-guardrail-log', x: 0, y: 4, w: 2, h: 2 },
    { i: 'strategy-live-telemetry', x: 0, y: 6, w: 1, h: 2 },
    { i: 'strategy-drift-monitor', x: 1, y: 6, w: 1, h: 2 },
    { i: 'strategy-training-metrics', x: 0, y: 8, w: 2, h: 2 },
    { i: 'strategy-action-timeline', x: 0, y: 10, w: 2, h: 2 },
    { i: 'strategy-feature-health', x: 0, y: 12, w: 1, h: 2 },
    { i: 'strategy-model-provenance', x: 1, y: 12, w: 1, h: 2 },
    { i: 'strategy-policy-mapping', x: 0, y: 14, w: 1, h: 2 },
    { i: 'strategy-state-pnl-matrix', x: 1, y: 14, w: 1, h: 2 },
    { i: 'strategy-suggest-exec', x: 0, y: 16, w: 2, h: 2 },
    { i: 'strategy-entropy-timeline', x: 0, y: 18, w: 1, h: 2 },
    { i: 'strategy-inference-latency', x: 1, y: 18, w: 1, h: 2 },
  ],
};

export const EXECUTION_LAYOUTS: Layouts = {
  lg: [
    { i: 'execution-orders', x: 0, y: 0, w: 8, h: 4 },
    { i: 'execution-latency', x: 8, y: 0, w: 4, h: 4 },
    { i: 'execution-spread-costs', x: 0, y: 4, w: 2, h: 2 },
    { i: 'execution-slippage', x: 2, y: 4, w: 4, h: 2 },
    { i: 'execution-cancel-reject', x: 6, y: 4, w: 2, h: 2 },
    { i: 'execution-connection', x: 8, y: 4, w: 2, h: 2 },
  ],
  md: [
    { i: 'execution-orders', x: 0, y: 0, w: 4, h: 4 },
    { i: 'execution-latency', x: 4, y: 0, w: 4, h: 4 },
    { i: 'execution-spread-costs', x: 0, y: 4, w: 2, h: 2 },
    { i: 'execution-slippage', x: 2, y: 4, w: 2, h: 2 },
    { i: 'execution-cancel-reject', x: 0, y: 6, w: 2, h: 2 },
    { i: 'execution-connection', x: 2, y: 6, w: 2, h: 2 },
  ],
  sm: [
    { i: 'execution-orders', x: 0, y: 0, w: 2, h: 4 },
    { i: 'execution-latency', x: 0, y: 4, w: 2, h: 4 },
    { i: 'execution-spread-costs', x: 0, y: 8, w: 1, h: 2 },
    { i: 'execution-slippage', x: 1, y: 8, w: 1, h: 2 },
    { i: 'execution-cancel-reject', x: 0, y: 10, w: 1, h: 2 },
    { i: 'execution-connection', x: 1, y: 10, w: 1, h: 2 },
  ],
};

export const REPORTS_LAYOUTS: Layouts = {
  lg: [
    { i: 'reports-daily-reports', x: 0, y: 0, w: 4, h: 4 },
    { i: 'reports-session-summary', x: 4, y: 0, w: 2, h: 2 },
    { i: 'reports-shadow-sim', x: 6, y: 0, w: 6, h: 4 },
    { i: 'reports-reason-codes', x: 0, y: 4, w: 2, h: 2 },
    { i: 'reports-alerts-history', x: 2, y: 4, w: 4, h: 2 },
    { i: 'reports-guardrail-log', x: 6, y: 4, w: 6, h: 2 },
  ],
  md: [
    { i: 'reports-daily-reports', x: 0, y: 0, w: 4, h: 4 },
    { i: 'reports-session-summary', x: 4, y: 0, w: 4, h: 2 },
    { i: 'reports-shadow-sim', x: 0, y: 4, w: 4, h: 4 },
    { i: 'reports-reason-codes', x: 4, y: 2, w: 4, h: 2 },
    { i: 'reports-alerts-history', x: 0, y: 8, w: 4, h: 2 },
    { i: 'reports-guardrail-log', x: 4, y: 8, w: 4, h: 2 },
  ],
  sm: [
    { i: 'reports-daily-reports', x: 0, y: 0, w: 1, h: 4 },
    { i: 'reports-session-summary', x: 1, y: 0, w: 1, h: 2 },
    { i: 'reports-shadow-sim', x: 0, y: 4, w: 2, h: 4 },
    { i: 'reports-reason-codes', x: 0, y: 8, w: 1, h: 2 },
    { i: 'reports-alerts-history', x: 1, y: 8, w: 1, h: 2 },
    { i: 'reports-guardrail-log', x: 0, y: 10, w: 2, h: 2 },
  ],
};

export const UNIVERSE_LAYOUTS: Layouts = {
  lg: [
    { i: 'universe-today-top10', x: 0, y: 0, w: 8, h: 4 },
    { i: 'universe-next-refresh', x: 8, y: 0, w: 4, h: 2 },
    { i: 'universe-year-top10', x: 8, y: 2, w: 4, h: 2 },
    { i: 'universe-active-intersection', x: 0, y: 4, w: 8, h: 2 },
    { i: 'universe-why-not-traded', x: 0, y: 6, w: 4, h: 2 },
  ],
  md: [
    { i: 'universe-today-top10', x: 0, y: 0, w: 4, h: 4 },
    { i: 'universe-next-refresh', x: 4, y: 0, w: 4, h: 2 },
    { i: 'universe-year-top10', x: 4, y: 2, w: 4, h: 2 },
    { i: 'universe-active-intersection', x: 0, y: 4, w: 4, h: 2 },
    { i: 'universe-why-not-traded', x: 4, y: 4, w: 4, h: 2 },
  ],
  sm: [
    { i: 'universe-today-top10', x: 0, y: 0, w: 2, h: 4 },
    { i: 'universe-next-refresh', x: 0, y: 4, w: 1, h: 2 },
    { i: 'universe-year-top10', x: 1, y: 4, w: 1, h: 2 },
    { i: 'universe-active-intersection', x: 0, y: 6, w: 2, h: 2 },
    { i: 'universe-why-not-traded', x: 0, y: 8, w: 2, h: 2 },
  ],
};

export const ANALYTICS_LAYOUTS: Layouts = {
  lg: [
    // Row 1
    { i: 'analytics-pnl-distribution', x: 0, y: 0, w: 4, h: 4 },
    { i: 'analytics-trade-outcome', x: 4, y: 0, w: 4, h: 4 },
    { i: 'analytics-state-heatmap', x: 8, y: 0, w: 4, h: 4 },

    // Row 2
    { i: 'analytics-sharpe-trends', x: 0, y: 4, w: 4, h: 4 },
    { i: 'analytics-strategy-comparison', x: 4, y: 4, w: 2, h: 4 },
    { i: 'analytics-market-regimes', x: 6, y: 4, w: 6, h: 4 },

    // Row 3
    { i: 'analytics-drawdown-analysis', x: 0, y: 8, w: 4, h: 4 },
    { i: 'analytics-expectancy', x: 4, y: 8, w: 4, h: 4 },
  ],
  md: [
    { i: 'analytics-pnl-distribution', x: 0, y: 0, w: 4, h: 4 },
    { i: 'analytics-trade-outcome', x: 4, y: 0, w: 4, h: 4 },
    { i: 'analytics-state-heatmap', x: 0, y: 4, w: 4, h: 4 },
    { i: 'analytics-sharpe-trends', x: 4, y: 4, w: 4, h: 4 },
    { i: 'analytics-strategy-comparison', x: 0, y: 8, w: 2, h: 4 },
    { i: 'analytics-market-regimes', x: 2, y: 8, w: 6, h: 4 },
    { i: 'analytics-drawdown-analysis', x: 0, y: 12, w: 4, h: 4 },
    { i: 'analytics-expectancy', x: 4, y: 12, w: 4, h: 4 },
  ],
  sm: [
    { i: 'analytics-pnl-distribution', x: 0, y: 0, w: 1, h: 4 },
    { i: 'analytics-trade-outcome', x: 1, y: 0, w: 1, h: 4 },
    { i: 'analytics-state-heatmap', x: 0, y: 4, w: 1, h: 4 },
    { i: 'analytics-sharpe-trends', x: 1, y: 4, w: 1, h: 4 },
    { i: 'analytics-strategy-comparison', x: 0, y: 8, w: 1, h: 4 },
    { i: 'analytics-market-regimes', x: 1, y: 8, w: 1, h: 4 },
    { i: 'analytics-drawdown-analysis', x: 0, y: 12, w: 1, h: 4 },
    { i: 'analytics-expectancy', x: 1, y: 12, w: 1, h: 4 },
  ],
};

export const SYSTEM_LAYOUTS: Layouts = {
  lg: [
    { i: 'system-service-health', x: 0, y: 0, w: 3, h: 2 },
    { i: 'system-clock-drift', x: 3, y: 0, w: 3, h: 2 },
    { i: 'system-resource-usage', x: 6, y: 0, w: 6, h: 2 },
    { i: 'system-containers', x: 0, y: 2, w: 6, h: 2 },
    { i: 'system-backup-status', x: 6, y: 2, w: 3, h: 2 },
    { i: 'system-guardrail-config', x: 9, y: 2, w: 3, h: 2 },
    { i: 'system-data-stream-monitor', x: 0, y: 4, w: 12, h: 2 },
  ],
  md: [
    { i: 'system-service-health', x: 0, y: 0, w: 3, h: 2 },
    { i: 'system-clock-drift', x: 3, y: 0, w: 3, h: 2 },
    { i: 'system-resource-usage', x: 6, y: 0, w: 2, h: 2 },
    { i: 'system-containers', x: 0, y: 2, w: 4, h: 2 },
    { i: 'system-backup-status', x: 4, y: 2, w: 2, h: 2 },
    { i: 'system-guardrail-config', x: 6, y: 2, w: 2, h: 2 },
    { i: 'system-data-stream-monitor', x: 0, y: 4, w: 4, h: 2 },
  ],
  sm: [
    { i: 'system-service-health', x: 0, y: 0, w: 1, h: 2 },
    { i: 'system-clock-drift', x: 1, y: 0, w: 1, h: 2 },
    { i: 'system-resource-usage', x: 0, y: 2, w: 2, h: 2 },
    { i: 'system-containers', x: 0, y: 4, w: 1, h: 2 },
    { i: 'system-backup-status', x: 1, y: 4, w: 1, h: 2 },
    { i: 'system-guardrail-config', x: 0, y: 6, w: 1, h: 2 },
    { i: 'system-data-stream-monitor', x: 1, y: 6, w: 1, h: 2 },
  ],
};

export const DEFAULT_LAYOUTS_MAP: Record<TabName, Layouts> = {
  overview: OVERVIEW_LAYOUTS,
  portfolio: PORTFOLIO_LAYOUTS,
  strategy: STRATEGY_ML_LAYOUTS,
  execution: EXECUTION_LAYOUTS,
  reports: REPORTS_LAYOUTS,
  universe: UNIVERSE_LAYOUTS,
  analytics: ANALYTICS_LAYOUTS,
  system: SYSTEM_LAYOUTS,
};

export const DEFAULT_DASHBOARD_LAYOUTS: Layouts = DEFAULT_LAYOUTS_MAP.overview;

export const TIME_RANGES: { id: TimeRangeId; label: string; ms: number }[] = [
  { id: '5m', label: '5m', ms: 5 * 60 * 1000 },
  { id: '30m', label: '30m', ms: 30 * 60 * 1000 },
  { id: '2h', label: '2h', ms: 2 * 60 * 60 * 1000 },
  { id: 'all', label: 'All', ms: Number.POSITIVE_INFINITY },
];

type DashboardState = {
  selectedSymbol: string | null;
  selectedSymbols: string[];
  timeRange: typeof TIME_RANGES[number];
  setSelectedSymbol: (symbol: string | null) => void;
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
  setTimeRange: (id: TimeRangeId) => void;
  tabLayouts: Record<TabName, Layouts | null>;
  layoutLoading: boolean;
  applyServerTabLayout: (tab: TabName, payload: { layouts?: Layouts }) => void;
  setTabLayout: (tab: TabName, layouts: Layouts) => void;
  resetTabLayout: (tab: TabName) => void;
  setLayoutLoading: (loading: boolean) => void;
};

export const useDashboardStore = create<DashboardState>((set, get) => ({
  selectedSymbol: null,
  selectedSymbols: [],
  timeRange: TIME_RANGES[0],
  layoutLoading: true,
  setSelectedSymbol: (symbol) =>
    set((state) => {
      if (!symbol) {
        return { selectedSymbol: null };
      }
      const normalized = symbol.trim().toUpperCase();
      if (!normalized) return state;
      const alreadyTracked = state.selectedSymbols.includes(normalized);
      return {
        selectedSymbol: normalized,
        selectedSymbols: alreadyTracked ? state.selectedSymbols : [...state.selectedSymbols, normalized],
      };
    }),
  addSymbol: (symbol) =>
    set((state) => {
      const normalized = symbol.trim().toUpperCase();
      if (!normalized || state.selectedSymbols.includes(normalized)) return state;
      return {
        selectedSymbols: [...state.selectedSymbols, normalized],
        selectedSymbol: state.selectedSymbol ?? normalized,
      };
    }),
  removeSymbol: (symbol) =>
    set((state) => {
      const normalized = symbol.trim().toUpperCase();
      if (!normalized) return state;
      const nextSymbols = state.selectedSymbols.filter((item) => item !== normalized);
      const nextSelected = state.selectedSymbol === normalized ? nextSymbols[0] ?? null : state.selectedSymbol;
      return {
        selectedSymbols: nextSymbols,
        selectedSymbol: nextSelected,
      };
    }),
  setTimeRange: (id) => set({ timeRange: TIME_RANGES.find((range) => range.id === id) ?? TIME_RANGES[0] }),
  tabLayouts: {
    overview: null,
    portfolio: null,
    strategy: null,
    execution: null,
    reports: null,
    universe: null,
    analytics: null,
    system: null,
  },
  applyServerTabLayout: (tab, payload) =>
    set((state) => ({
      tabLayouts: { ...state.tabLayouts, [tab]: payload.layouts ? cloneLayouts(payload.layouts) : state.tabLayouts[tab] },
    })),
  setTabLayout: (tab, layouts) => set((state) => ({
    tabLayouts: { ...state.tabLayouts, [tab]: cloneLayouts(layouts) },
  })),
  resetTabLayout: (tab) => set((state) => ({
    tabLayouts: { ...state.tabLayouts, [tab]: cloneLayouts(DEFAULT_LAYOUTS_MAP[tab]) },
  })),
  setLayoutLoading: (loading) => set({ layoutLoading: loading }),
}));
