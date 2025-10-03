'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Layout, Layouts } from 'react-grid-layout';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import StrategyGrid from './StrategyGrid';

import { useStrategyStore } from '@/lib/strategyStore';
import { useTelemetryFeed } from '@/hooks/useTelemetryFeed';
import { useTelemetryStore, type GuardrailEntry } from '@/lib/telemetryStore';
import { DEFAULT_LAYOUTS_MAP, useDashboardStore, type TabName } from '@/lib/dashboardStore';
import { cloneLayouts, sanitizeLayouts } from '@/lib/layoutUtils';
import { useControlChannel, type ControlChannelStatus } from '@/hooks/useControlChannel';
import { SymbolOverviewGrid } from './SymbolOverviewGrid';
import { SymbolDetailPanel } from './SymbolDetailPanel';
import { PerformanceChart } from './PerformanceChart';
import { MockFeedControl } from './MockFeedControl';
import { PnlSummaryPanel, DrawdownGaugePanel, ExposurePiePanel, HmmStatePanel, LastTradesPanel, SystemHealthLightsPanel, ControlPanel } from './dashboard/OverviewPanels';
import { PositionsTablePanel, ExposureMetricsPanel, PnlTimelinePanel, RiskMetricsPanel as PortfolioRiskPanel, CashBuyingPowerPanel } from './dashboard/PortfolioPanels';
import { ActiveModelInfoPanel, CurrentStatePanel, StatePnlMatrixPanel, GuardrailLogPanel as StrategyGuardrailPanel, DriftMonitorPanel, OnlineUpdatesPanel, TrainingMetricsPanel, SuggestedVsExecutedPanel, FeatureHealthPanel, ModelProvenancePanel, PolicyMappingPanel, StateToPnlMatrixPanel, ActionTimelinePanel, EntropyTimelinePanel, InferenceLatencyPanel } from './dashboard/StrategyMlPanels';
import { OrdersTablePanel, LatencyStatsPanel, SpreadCostsPanel, SlippagePanel, CancelRejectRatePanel, ConnectionPanel } from './dashboard/ExecutionPanels';
import { DailyReportsPanel, SessionSummaryPanel, ShadowSimPanel, ReasonCodeLogPanel, AlertsHistoryPanel, GuardrailLogTable } from './dashboard/ReportsPanels';
import { ServiceHealthPanel, ClockDriftPanel, ResourceUsagePanel, ContainersPanel, BackupStatusPanel, GuardrailConfigPanel, DataStreamMonitorPanel } from './dashboard/SystemOpsPanels';
import { TodayTop10Panel, ActiveIntersectionPanel, WhyNotTradedPanel, NextRefreshPanel, YearTop10Panel } from './dashboard/UniverseScreenerPanels';
import { PnLDistributionPanel, TradeOutcomeHistogramPanel, StateReturnsHeatmapPanel, SharpeTrendsPanel, StrategyComparisonsPanel, MarketRegimesPanel, DrawdownAnalysisPanel, ExpectancyCalculatorPanel } from './dashboard/AnalyticsPanels';
import { PnlPriceCard, ExposureNotionalCard, PositionsCard, DecisionsActionsCard, StatesReturnsCard, ModelHealthCard, LatencyCard, ConnectivityHealthCard, UniverseScreenerCard, Settings } from './analytics';

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function L2Dashboard() {
  const boot = useStrategyStore((state) => state.bootFromStorage);
  const { status: controlStatus, sendCommand } = useControlChannel();
  const tabLayouts = useDashboardStore((state) => state.tabLayouts);
  const layoutLoading = useDashboardStore((state) => state.layoutLoading);
  const setTabLayout = useDashboardStore((state) => state.setTabLayout);
  const resetTabLayout = useDashboardStore((state) => state.resetTabLayout);
  const applyServerTabLayout = useDashboardStore((state) => state.applyServerTabLayout);
  const setLayoutLoading = useDashboardStore((state) => state.setLayoutLoading);
  const layoutMode = useStrategyStore((state) => (state.settings.tradingEnabled ? 'live' : 'paper'));

  // Create dynamic layouts for each tab using the same persistence system
  const [activeTab, setActiveTab] = useState<TabName>('overview');
  const [alertDrawerOpen, setAlertDrawerOpen] = useState(false);

  const selectedSymbol = useDashboardStore((state) => state.selectedSymbol);
  const watchlist = useDashboardStore((state) => state.selectedSymbols);
  const ticks = useTelemetryStore((state) => state.ticks);

  const activeSymbol = useMemo(() => {
    if (selectedSymbol) return selectedSymbol;
    if (watchlist.length) return watchlist[0];
    const tickSymbols = Object.keys(ticks).filter(s => s !== 'MOCK');
    return tickSymbols[0] ?? null;
  }, [selectedSymbol, ticks, watchlist]);

  // IMPORTANT: Layout persistence is TAB-scoped (NOT symbol-scoped).
  // Changing this will fragment saved layouts per symbol and look like "not remembering".
  const layoutContextKey = activeTab; // stable per tab

  // The layout persistence logic now uses symbol context consistently across client/server
  const summaryTabContext = useMemo(() =>
    layoutContextKey,
    [layoutContextKey]
  );

  useEffect(() => {
    // This only runs once to load settings from localStorage
    boot();
  }, [boot]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const loadLayout = async () => {
      setLayoutLoading(true);
      try {
        const params = new URLSearchParams({ mode: layoutMode, symbol: summaryTabContext });
        const response = await fetch(`/api/layouts?${params.toString()}`, { // summaryTabContext is the tab name
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('layout-fetch-failed');
        }
        const payload = parseLayoutResponse(await response.json());
        if (cancelled) return;

        const defaultLayout = DEFAULT_LAYOUTS_MAP[activeTab];
        const layoutsToApply = payload.layouts ?? cloneLayouts(defaultLayout);

        applyServerTabLayout(activeTab, {
          layouts: layoutsToApply,
        });
      } catch (e) {
        if (cancelled) return;
        console.error(`[LAYOUT] Failed to load layout for ${layoutContextKey}`, e);
        // Fallback to the correct default layout for the active tab on error
        const defaultLayout = DEFAULT_LAYOUTS_MAP[activeTab];
        applyServerTabLayout(activeTab, { layouts: cloneLayouts(defaultLayout) });
      } finally {
        if (!cancelled) {
          setLayoutLoading(false);
        }
      }
    };

    void loadLayout();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [applyServerTabLayout, layoutContextKey, layoutMode, setLayoutLoading, summaryTabContext, activeTab]);

  const persistLayout = useCallback(
    (layoutsToPersist: Layouts) => {
      // Use the same context key that loading uses: summaryTabContext
      // This ensures save and load use identical mode/symbol combinations
      const payload = {
        mode: layoutMode, // summaryTabContext is the tab name
        symbol: summaryTabContext,
        layouts: cloneLayouts(layoutsToPersist),
      };
      console.log(`[LAYOUT] Saving layout for ${layoutMode}::${summaryTabContext}`, {
        layouts: layoutsToPersist
      });
      void fetch('/api/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((error) => {
        console.error('[LAYOUT] Failed to persist layout:', error);
      });
    },
    [layoutMode, summaryTabContext],
  );

  const resetLayoutOnServer = useCallback(() => {
    const payload = {
      mode: layoutMode, // Use the layout context key for reset
      symbol: layoutContextKey,
      reset: true,
    };
    void fetch('/api/layouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  }, [layoutMode, layoutContextKey]);

  const handleLayoutChange = useCallback(
    (_current: Layout[], allLayouts: Layouts | undefined) => {
      if (!allLayouts || layoutLoading) {
        return;
      }
      setTabLayout(activeTab, allLayouts);
      persistLayout(allLayouts);
    },
    [activeTab, layoutLoading, persistLayout, setTabLayout],
  );

  const handleResizeStop = useCallback(
    (_current: Layout[], _oldItem: Layout, _newItem: Layout, _placeholder: Layout, _event: MouseEvent, _element: HTMLElement) => {
      // Trigger layout change on resize stop to persist changes
      const currentLayouts = useDashboardStore.getState().tabLayouts[activeTab];
      if (!layoutLoading && currentLayouts) {
        persistLayout(currentLayouts);
      }
    },
    [activeTab, layoutLoading, persistLayout],
  );

  const handleResetLayout = useCallback(() => {
    resetTabLayout(activeTab);
    resetLayoutOnServer();
  }, [activeTab, resetTabLayout, resetLayoutOnServer]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as TabName);
  };

  useTelemetryFeed();

  return (
    <div className="min-h-screen bg-[#050507] text-white legacy-dashboard">
        <header className="sticky top-0 z-20 border-b border-[#181b22] bg-[#07090d]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-6 py-4">
            <h1 className="text-2xl font-semibold">Level-2 Markov Control Room</h1>
            <p className="text-sm text-zinc-500">Real-time execution oversight · model state awareness · operational guardrails</p>
          </div>
        </header>

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <StatusBar controlStatus={controlStatus} />
        <Tabs defaultValue="overview" onValueChange={handleTabChange} className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <TabsList className="flex flex-wrap gap-2 bg-transparent p-0">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="strategy">Strategy · ML</TabsTrigger>
              <TabsTrigger value="execution">Execution · IBKR</TabsTrigger>
              <TabsTrigger value="reports">Reports · Logs</TabsTrigger>
              <TabsTrigger value="universe">Universe · Screener</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="system">System · Ops</TabsTrigger>
            </TabsList>

          </div>

          <TabsContent value="overview">
            {tabLayouts.overview ? (
              <ResponsiveGridLayout
                className="dashboard-grid"
                layouts={tabLayouts.overview}
                cols={{ lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }}
                rowHeight={80}
                margin={[16, 16]}
                containerPadding={[0, 16]}
                compactType={null}
                isResizable={!layoutLoading}
                isDraggable={!layoutLoading}
                resizeHandles={['se']}
                draggableCancel=".no-drag,button,input,select,textarea"
                onLayoutChange={handleLayoutChange}
                onResizeStop={handleResizeStop}
                onResizeStart={() => console.log('[LAYOUT] Resize started')}
                onDragStart={() => console.log('[LAYOUT] Drag started')}
                onDragStop={() => console.log('[LAYOUT] Drag stopped')}
              >
                <AlertToggleButton isOpen={alertDrawerOpen} onToggle={() => setAlertDrawerOpen(!alertDrawerOpen)} />
                <div key="overview-pnl" className="h-full"><PnlSummaryPanel /></div>
                <div key="overview-dd" className="h-full"><DrawdownGaugePanel /></div>
                <div key="overview-exposure" className="h-full"><ExposurePiePanel /></div>
                <div key="overview-hmm" className="h-full"><HmmStatePanel /></div>
                <div key="overview-trades" className="h-full"><LastTradesPanel /></div>
                <div key="overview-health" className="h-full"><SystemHealthLightsPanel /></div>
                <div key="overview-control" className="h-full"><ControlPanel onCommand={sendCommand} controlStatus={controlStatus} /></div>
                <div key="overview-watchlist" className="h-full"><SymbolOverviewGrid /></div>
                <div key="overview-chart" className="h-full"><PerformanceChart symbol={activeSymbol ?? undefined} /></div>
                <div key="overview-detail" className="h-full"><SymbolDetailPanel /></div>
              </ResponsiveGridLayout>
            ) : (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                {layoutLoading ? 'Loading layout...' : 'Preparing dashboard...'}
              </div>
            )}
          </TabsContent>

          <TabsContent value="portfolio">
            {tabLayouts.portfolio ? (
              <ResponsiveGridLayout
                className="dashboard-grid"
                layouts={tabLayouts.portfolio}
                cols={{ lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }}
                rowHeight={80}
                margin={[16, 16]}
                containerPadding={[0, 16]}
                compactType={null}
                isResizable={!layoutLoading}
                isDraggable={!layoutLoading}
                resizeHandles={['se']}
                draggableCancel=".no-drag,button,input,select,textarea"
                onLayoutChange={handleLayoutChange}
                onResizeStop={handleResizeStop}
              >
                <div key="portfolio-positions" className="h-full"><PositionsTablePanel /></div>
                <div key="portfolio-exposure" className="h-full"><ExposureMetricsPanel /></div>
                <div key="portfolio-pnl-timeline" className="h-full"><PnlTimelinePanel /></div>
                <div key="portfolio-risk" className="h-full"><PortfolioRiskPanel /></div>
                <div key="portfolio-cash" className="h-full"><CashBuyingPowerPanel /></div>
              </ResponsiveGridLayout>
            ) : (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                {layoutLoading ? 'Loading layout...' : 'Preparing dashboard...'}
              </div>
            )}
          </TabsContent>

          <TabsContent value="strategy">
            {tabLayouts.strategy ? (
              <ResponsiveGridLayout
                className="dashboard-grid"
                layouts={tabLayouts.strategy}
                cols={{ lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }}
                rowHeight={80}
                margin={[16, 16]}
                containerPadding={[0, 16]}
                compactType={null}
                isResizable={!layoutLoading}
                isDraggable={!layoutLoading}
                resizeHandles={['se']}
                draggableCancel=".no-drag,button,input,select,textarea"
                onLayoutChange={handleLayoutChange}
                onResizeStop={handleResizeStop}
              >
                <div key="strategy-active-model" className="h-full"><ActiveModelInfoPanel /></div>
                <div key="strategy-current-state" className="h-full"><CurrentStatePanel /></div>
                <div key="strategy-transition-matrix" className="h-full"><StatePnlMatrixPanel /></div>
                <div key="strategy-guardrail-log" className="h-full"><StrategyGuardrailPanel /></div>
                <div key="strategy-drift-monitor" className="h-full"><DriftMonitorPanel /></div>
                <div key="strategy-live-telemetry" className="h-full"><OnlineUpdatesPanel /></div>
                <div key="strategy-training-metrics" className="h-full"><TrainingMetricsPanel /></div>
                <div key="strategy-action-timeline" className="h-full"><ActionTimelinePanel /></div>
                <div key="strategy-feature-health" className="h-full"><FeatureHealthPanel /></div>
                <div key="strategy-model-provenance" className="h-full"><ModelProvenancePanel /></div>
                <div key="strategy-policy-mapping" className="h-full"><PolicyMappingPanel /></div>
                <div key="strategy-state-pnl-matrix" className="h-full"><StateToPnlMatrixPanel /></div>
                <div key="strategy-entropy-timeline" className="h-full"><EntropyTimelinePanel /></div>
                <div key="strategy-inference-latency" className="h-full"><InferenceLatencyPanel /></div>
                <div key="strategy-suggest-exec" className="h-full"><SuggestedVsExecutedPanel /></div>
              </ResponsiveGridLayout>
            ) : (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                {layoutLoading ? 'Loading layout...' : 'Preparing dashboard...'}
              </div>
            )}

            <div className="mt-6 rounded-xl border border-zinc-800 bg-[#0d101a] p-4">
              <div className="text-xs text-zinc-500">Strategy Overrides</div>
              <div className="mt-3"><StrategyGrid /></div>
            </div>
          </TabsContent>

          <TabsContent value="execution">
            {tabLayouts.execution ? (
              <ResponsiveGridLayout
                className="dashboard-grid"
                layouts={tabLayouts.execution}
                cols={{ lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }}
                rowHeight={80}
                margin={[16, 16]}
                containerPadding={[0, 16]}
                compactType={null}
                isResizable={!layoutLoading}
                isDraggable={!layoutLoading}
                resizeHandles={['se']}
                draggableCancel=".no-drag,button,input,select,textarea"
                onLayoutChange={handleLayoutChange}
                onResizeStop={handleResizeStop}
              >
                <div key="execution-orders" className="h-full"><OrdersTablePanel /></div>
                <div key="execution-latency" className="h-full"><LatencyStatsPanel /></div>
                <div key="execution-spread-costs" className="h-full"><SpreadCostsPanel /></div>
                <div key="execution-slippage" className="h-full"><SlippagePanel /></div>
                <div key="execution-cancel-reject" className="h-full"><CancelRejectRatePanel /></div>
                <div key="execution-connection" className="h-full"><ConnectionPanel /></div>
              </ResponsiveGridLayout>
            ) : (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                {layoutLoading ? 'Loading layout...' : 'Preparing dashboard...'}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports">
            {tabLayouts.reports ? (
              <ResponsiveGridLayout
                className="dashboard-grid"
                layouts={tabLayouts.reports}
                cols={{ lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }}
                rowHeight={80}
                margin={[16, 16]}
                containerPadding={[0, 16]}
                compactType={null}
                isResizable={!layoutLoading}
                isDraggable={!layoutLoading}
                resizeHandles={['se']}
                draggableCancel=".no-drag,button,input,select,textarea"
                onLayoutChange={handleLayoutChange}
                onResizeStop={handleResizeStop}
              >
                <div key="reports-daily-reports" className="h-full"><DailyReportsPanel /></div>
                <div key="reports-session-summary" className="h-full"><SessionSummaryPanel /></div>
                <div key="reports-shadow-sim" className="h-full"><ShadowSimPanel /></div>
                <div key="reports-reason-codes" className="h-full"><ReasonCodeLogPanel /></div>
                <div key="reports-alerts-history" className="h-full"><AlertsHistoryPanel /></div>
                <div key="reports-guardrail-log" className="h-full">
                  <div className="border-b border-zinc-800 pb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Guardrail Log</div>
                  <GuardrailLogTable />
                </div>
              </ResponsiveGridLayout>
            ) : (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                {layoutLoading ? 'Loading layout...' : 'Preparing dashboard...'}
              </div>
            )}
          </TabsContent>

          <TabsContent value="universe">
            {tabLayouts.universe ? (
              <ResponsiveGridLayout
                className="dashboard-grid"
                layouts={tabLayouts.universe}
                cols={{ lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }}
                rowHeight={80}
                margin={[16, 16]}
                containerPadding={[0, 16]}
                compactType={null}
                isResizable={!layoutLoading}
                isDraggable={!layoutLoading}
                resizeHandles={['se']}
                draggableCancel=".no-drag,button,input,select,textarea"
                onLayoutChange={handleLayoutChange}
                onResizeStop={handleResizeStop}
              >
                <div key="universe-today-top10" className="h-full"><TodayTop10Panel /></div>
                <div key="universe-next-refresh" className="h-full"><NextRefreshPanel /></div>
                <div key="universe-year-top10" className="h-full"><YearTop10Panel /></div>
                <div key="universe-active-intersection" className="h-full"><ActiveIntersectionPanel /></div>
                <div key="universe-why-not-traded" className="h-full"><WhyNotTradedPanel /></div>
              </ResponsiveGridLayout>
            ) : (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                {layoutLoading ? 'Loading layout...' : 'Preparing dashboard...'}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics">
            {/* Analytics Controls */}
            <div className="flex items-center justify-between mb-4 p-4 bg-[#10131d] rounded-lg border border-zinc-800">
              <div className="text-sm text-zinc-300">
                Analytics Dashboard: 12-column grid with configurable layouts
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleResetLayout}
                  className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors"
                >
                  Reset Layout
                </button>
                <div className="w-px h-6 bg-zinc-600"></div>
                <div className="text-xs text-zinc-500 flex items-center gap-2">
                  <span>Lock Panels</span>
                  <label className="switch">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-7 h-4 bg-zinc-600 peer-checked:bg-emerald-500 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:w-3 after:h-3 after:rounded-full after:transition-all"></div>
                  </label>
                </div>
              </div>
            </div>

            <Settings />

            {tabLayouts.analytics ? (
              <ResponsiveGridLayout
                className="dashboard-grid"
                layouts={tabLayouts.analytics}
                cols={{ lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }}
                rowHeight={80}
                margin={[16, 16]}
                containerPadding={[0, 16]}
                compactType={null}
                isResizable={!layoutLoading}
                isDraggable={!layoutLoading}
                resizeHandles={['se']}
                draggableCancel=".no-drag,button,input,select,textarea"
                onLayoutChange={handleLayoutChange}
                onResizeStop={handleResizeStop}
              >
                <div key="analytics-pnl-price" className="h-full"><PnlPriceCard /></div>
                <div key="analytics-exposure-notional" className="h-full"><ExposureNotionalCard /></div>
                <div key="analytics-positions" className="h-full"><PositionsCard /></div>
                <div key="analytics-decisions-actions" className="h-full"><DecisionsActionsCard /></div>
                <div key="analytics-states-returns" className="h-full"><StatesReturnsCard /></div>
                <div key="analytics-model-health" className="h-full"><ModelHealthCard /></div>
                <div key="analytics-latency" className="h-full"><LatencyCard /></div>
                <div key="analytics-connectivity-health" className="h-full"><ConnectivityHealthCard /></div>
                <div key="analytics-universe-screener" className="h-full"><UniverseScreenerCard /></div>
              </ResponsiveGridLayout>
            ) : (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                {layoutLoading ? 'Loading layout...' : 'Preparing dashboard...'}
              </div>
            )}
          </TabsContent>

          <TabsContent value="system">
            {tabLayouts.system ? (
              <ResponsiveGridLayout
                className="dashboard-grid"
                layouts={tabLayouts.system}
                cols={{ lg: 12, md: 8, sm: 4, xs: 2, xxs: 1 }}
                rowHeight={80}
                margin={[16, 16]}
                containerPadding={[0, 16]}
                compactType={null}
                isResizable={!layoutLoading}
                isDraggable={!layoutLoading}
                resizeHandles={['se']}
                draggableCancel=".no-drag,button,input,select,textarea"
                onLayoutChange={handleLayoutChange}
                onResizeStop={handleResizeStop}
              >
                <div key="system-service-health" className="h-full"><ServiceHealthPanel /></div>
                <div key="system-clock-drift" className="h-full"><ClockDriftPanel /></div>
                <div key="system-resource-usage" className="h-full"><ResourceUsagePanel /></div>
                <div key="system-containers" className="h-full"><ContainersPanel /></div>
                <div key="system-backup-status" className="h-full"><BackupStatusPanel /></div>
                <div key="system-guardrail-config" className="h-full"><GuardrailConfigPanel /></div>
                <div key="system-data-stream-monitor" className="h-full">
                  <div className="border-b border-zinc-800 pb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Data Stream Monitor</div>
                  <DataStreamMonitorPanel />
                </div>
              </ResponsiveGridLayout>
            ) : (
              <div className="flex items-center justify-center h-64 text-zinc-400">
                {layoutLoading ? 'Loading layout...' : 'Preparing dashboard...'}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <CollapsibleAlertDrawer
        alerts={useTelemetryStore.getState().guardrails}
        isOpen={alertDrawerOpen}
        onToggle={() => setAlertDrawerOpen(!alertDrawerOpen)}
      />
    </div>
  );
}

function AlertToggleButton({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const criticalCount = guardrails.filter(g => g.severity === 'block').length;
  const warningCount = guardrails.filter(g => g.severity === 'warn').length;

  return (
    <div className="bg-[#0d101a] border border-zinc-800 rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">System Alerts</h3>
        <button
          onClick={onToggle}
          className="px-3 py-1.5 text-xs rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
        >
          {isOpen ? 'Close' : 'Open'} Drawer
        </button>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-xs text-zinc-400">Critical: {criticalCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-xs text-zinc-400">Warnings: {warningCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-xs text-zinc-400">Total: {guardrails.length}</span>
        </div>
      </div>
      <div className="mt-3 text-xs text-zinc-500">
        {isOpen ? 'Alert drawer is open - collapse to save space' : 'Click to expand alerts drawer'}
      </div>
    </div>
  );
}

function CollapsibleAlertDrawer({ alerts, isOpen, onToggle }: { alerts: GuardrailEntry[], isOpen: boolean, onToggle: () => void }) {
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  const toggleAlertExpansion = (alertId: string) => {
    const newExpanded = new Set(expandedAlerts);
    if (newExpanded.has(alertId)) {
      newExpanded.delete(alertId);
    } else {
      newExpanded.add(alertId);
    }
    setExpandedAlerts(newExpanded);
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-gray-900 text-white shadow-lg transition-transform duration-300 z-50 ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-lg font-semibold">System Alerts ({alerts?.length || 0})</h3>
        <button
          onClick={onToggle}
          className="hover:bg-gray-700 p-2 rounded-md transition-colors"
        >
          {isOpen ? '▼' : '▲'}
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {alerts?.length > 0 ? (
          alerts.map((alert: GuardrailEntry, index: number) => {
            const alertId = alert.id || `alert-${index}`;
            return (
              <div key={alertId} className="border-b border-gray-700 last:border-b-0">
                <div
                  className="p-4 hover:bg-gray-800 cursor-pointer flex items-center justify-between"
                  onClick={() => toggleAlertExpansion(alertId)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${alert.severity === 'block' ? 'bg-red-500' : alert.severity === 'warn' ? 'bg-amber-500' : 'bg-blue-500'}`}></div>
                    <div className="flex-1">
                      <div className="font-medium">{alert.message}</div>
                      <div className="text-sm text-gray-400">{new Date(alert.ts || Date.now()).toLocaleTimeString()}</div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {expandedAlerts.has(alertId) ? '▼' : '▶'}
                  </div>
                </div>
                {expandedAlerts.has(alertId) && (
                  <div className="px-4 pb-4 text-sm text-gray-300">
                    <div>Symbol: {alert.symbol || 'SYSTEM'}</div>
                    <div>Rule: {alert.rule}</div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center text-gray-400">
            No active alerts
          </div>
        )}
      </div>
    </div>
  );
}

type LayoutResponsePayload = {
  layouts?: Layouts;
};

function parseLayoutResponse(input: unknown): LayoutResponsePayload {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const record = input as Record<string, unknown>;
  const layouts = sanitizeLayouts(record.layouts ?? null) ?? undefined;
  return { layouts };
}

// Sanitize layout items to prevent corrupted old data from breaking the UI
function sanitizeLayoutItems(items: any[]): Layout[] {
  const COLS = 24;
  return (items ?? [])
    .filter(Boolean)
    .map((it: any) => ({
      i: String(it.i),
      w: Math.max(2, Math.min(Number(it.w ?? 4), COLS)),
      h: Math.max(2, Math.min(Number(it.h ?? 6), 64)),
      x: Math.max(0, Math.min(Number(it.x ?? 0), COLS - 1)),
      y: Math.max(0, Math.max(Number(it.y ?? 0), 0)),
      static: !!it.static,
      minW: it.minW ?? 2,
      minH: it.minH ?? 2,
    }));
}

// Apply sanitization right before setting layouts
function sanitizeAndApplyLayouts(layouts: Layouts | null, activeTab: TabName) {
  if (!layouts) return null;

  const sanitized: Layouts = {};
  for (const [breakpoint, items] of Object.entries(layouts)) {
    sanitized[breakpoint] = sanitizeLayoutItems(items);
  }
  return sanitized;
}



function StatusBar({ controlStatus }: { controlStatus: ControlChannelStatus }) {
  const positions = useTelemetryStore((state) => state.positions);
  const ticks = useTelemetryStore((state) => state.ticks);
  const guardrails = useTelemetryStore((state) => state.guardrails);
  const lastTickAt = useTelemetryStore((state) => state.lastTickAt);
  const bridgeStatus = useTelemetryStore((state) => state.bridgeStatus);
  const markov = useTelemetryStore((state) => state.markov);
  const fills = useTelemetryStore((state) => state.fills);
  const tradingEnabled = useStrategyStore((state) => state.settings.tradingEnabled);

  const formatUsd = (value: number): string => {
    if (!Number.isFinite(value)) return '—';
    const sign = value >= 0 ? '' : '-';
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
    return `${sign}$${abs.toFixed(2)}`;
  };

  const netPnl = useMemo(() => {
    return Object.values(positions).reduce((acc, pos) => {
      const last = ticks[pos.symbol]?.price ?? pos.avgPx;
      return acc + pos.realizedPnL + (last - pos.avgPx) * pos.qty;
    }, 0);
  }, [positions, ticks]);

  const ddEvent = guardrails.find((g) => g.rule === 'DD');
  const drawdownPct = ddEvent ? parseFloat(ddEvent.message.replace('%', '')) : 0;
  const drawdown = ddEvent ? ddEvent.message : '0%';
  const lastTickAge = lastTickAt ? Date.now() - lastTickAt : null;
  const latencyMs = fills.length ? Math.max(0, Date.now() - fills[0].ts) : 0;
  const latencyText = latencyMs > 0 ? `${latencyMs} ms` : '—';
  const entropy = (typeof markov === 'object' && markov !== null && 'entropy' in markov && typeof markov.entropy === 'number') ? markov.entropy : 0;

  const getTone = (value: number, thresholds: { warn?: number; error: number }): string => {
    if (value >= thresholds.error) return 'text-red-400';
    if (thresholds.warn && value >= thresholds.warn) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const controlStatusMap: Record<ControlChannelStatus, { text: string; tone: string; icon: string }> = {
    open: { text: 'Connected', tone: 'text-emerald-300', icon: '🟢' },
    connecting: { text: 'Connecting…', tone: 'text-amber-300', icon: '🟡' },
    error: { text: 'Error', tone: 'text-rose-300', icon: '🔴' },
    closed: { text: 'Reconnecting…', tone: 'text-amber-300', icon: '🟡' },
  };
  const controlLabel = controlStatusMap[controlStatus];

  const items = [
    { label: 'PnL', value: formatUsd(netPnl), tone: netPnl < 0 ? 'text-red-400' : 'text-emerald-400', icon: netPnl >= 0 ? '✅' : '❌' },
    { label: 'Drawdown', value: drawdown, tone: getTone(drawdownPct, { warn: 2, error: 5 }), icon: drawdownPct >= 5 ? '❌' : drawdownPct >= 2 ? '⚠️' : '✅' },
    { label: 'Latency', value: latencyText, tone: getTone(latencyMs, { warn: 100, error: 500 }), icon: latencyMs >= 500 ? '❌' : latencyMs >= 100 ? '⚠️' : '✅' },
    { label: 'IBKR', value: bridgeStatus === 'connected' ? 'Connected' : 'Disconnected', tone: bridgeStatus === 'connected' ? 'text-emerald-400' : 'text-red-400', icon: bridgeStatus === 'connected' ? '✅' : '❌' },
    { label: 'Data Freshness', value: lastTickAge !== null ? `${(lastTickAge / 1000).toFixed(1)}s` : '—', tone: getTone(lastTickAge ?? 99999, { warn: 3000, error: 10000 }), icon: lastTickAge === null || lastTickAge >= 10000 ? '❌' : lastTickAge >= 3000 ? '⚠️' : '✅' },
    { label: 'Model Entropy', value: entropy.toFixed(2), tone: getTone(entropy, { warn: 0.6, error: 1 }), icon: entropy >= 1 ? '❌' : entropy >= 0.6 ? '⚠️' : '✅' },
    { label: 'Trading', value: tradingEnabled ? 'Enabled' : 'Disabled', tone: tradingEnabled ? 'text-emerald-400' : 'text-red-400', icon: tradingEnabled ? '✅' : '❌' },
    { label: 'Control Link', value: controlLabel.text, tone: controlLabel.tone, icon: controlLabel.icon },
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-3 rounded-2xl border border-zinc-800 bg-[#090c15] p-4">
      {items.map((item) => (
        <div key={item.label} className="space-y-1 text-xs min-w-0 flex-1 text-center">
          <div className="flex items-center justify-center gap-1 uppercase tracking-wide text-zinc-500">
            {item.icon && <span>{item.icon}</span>}
            {item.label}
          </div>
          <div className={`text-sm font-semibold ${item.tone}`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}
