'use client';

import React, { useEffect, useState } from 'react';
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from 'react-resizable-panels';
import { getCockpitKey, loadLocal, saveLocal } from '@/lib/persist/cockpit';
import { getClampedCockpitLayout, COCKPIT_DEFAULTS, COCKPIT_MIN_SIZES } from '@/lib/persist/layout';
import { cockpitActions, useCockpitStore } from '@/lib/cockpitStore';
import LeftWatchlist from '@/components/panes/LeftWatchlist';
import { TopBar } from '@/components/panes/TopBar';
import { BottomBar } from '@/components/panes/BottomBar';
import { useDevSseClient } from '@/lib/devSseClient';
import { scheduleGuardrails } from '@/lib/guardrailStore';
import { isGuardrailEvent } from '@/lib/contracts';
import OrdersFillsPositions from '@/components/panes/OrdersFillsPositions';

export default function TradingCockpit() {
  const [sizes, setSizes] = useState<Record<keyof typeof COCKPIT_DEFAULTS, number>>({ ...COCKPIT_DEFAULTS });

  const tab = 'main'; // Default tab for now
  const focusedSymbol = useCockpitStore((state) => state.focusedSymbol);
  const onSymbolFocus = cockpitActions.setFocusedSymbol;

  // SSE connection for guardrails and other events
  useDevSseClient({
    onEvent: (event) => {
      if (event.event === 'guardrail' && isGuardrailEvent(event)) {
        scheduleGuardrails({
          ts: event.timestamp,
          symbol: event.symbol,
          reason: event.code,
          detail: event.detail,
        });
      }
    },
  });

  // Load persisted sizes on mount with clamping
  useEffect(() => {
    const clampedSizes = getClampedCockpitLayout(tab);
    setSizes(clampedSizes);
  }, [tab]);

  // Update sizes and persist
  const updateSizes = (newSizes: Partial<typeof sizes>) => {
    const updated = { ...sizes, ...newSizes };
    setSizes(updated);
    saveLocal(getCockpitKey(tab), updated);
  };

  // Hotkey event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent default behavior for our hotkeys
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // Kill: Ctrl/Cmd + K
      if (isCtrlOrCmd && event.key === 'k') {
        event.preventDefault();
        cockpitActions.kill();
        return;
      }

      // Flatten: Ctrl/Cmd + F
      if (isCtrlOrCmd && event.key === 'f') {
        event.preventDefault();
        cockpitActions.flatten();
        return;
      }

      // Reconnect: R (no modifiers)
      if (!isCtrlOrCmd && event.key === 'r') {
        event.preventDefault();
        cockpitActions.reconnect();
        return;
      }

      // Mode toggle: F1
      if (event.key === 'F1') {
        event.preventDefault();
        cockpitActions.toggleMode();
        return;
      }
    };

    // Add global event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <PanelGroup direction="vertical" className="h-screen bg-white" autoSaveId="cockpit:v1:panels" onLayout={(verticalSizes: number[]) => {
      updateSizes({
        topBar: verticalSizes[0],
        middle: verticalSizes[1],
        bottom: verticalSizes[2],
        bottomBar: verticalSizes[3],
      });
    }}>
      {/* TopBar */}
      <Panel defaultSize={sizes.topBar} minSize={5} maxSize={20}>
        <TopBar />
      </Panel>

      <PanelResizeHandle className="h-1 bg-gray-300 hover:bg-gray-400 transition-colors" />

      {/* Middle Section */}
      <Panel defaultSize={sizes.middle} minSize={30}>
        <PanelGroup direction="horizontal" onLayout={(middleSizes: number[]) => {
          updateSizes({
            leftWatchlist: middleSizes[0],
            center: middleSizes[1],
            rightMicrocharts: middleSizes[2],
          });
        }}>
          {/* LeftWatchlist */}
          <Panel defaultSize={sizes.leftWatchlist} minSize={15} maxSize={40}>
            <LeftWatchlist onSymbolFocus={onSymbolFocus} focusedSymbol={focusedSymbol} />
          </Panel>

          <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-gray-400 transition-colors" />

          {/* Center: Ladder + OrderTicket + HMMStateStrip */}
          <Panel defaultSize={sizes.center} minSize={30}>
            <div className="h-full bg-white p-4 border-r flex flex-col">
              <div className="flex-1 mb-4">
                <h2 className="text-sm font-semibold mb-2">
                  Ladder {focusedSymbol && <span className="text-blue-600">({focusedSymbol})</span>}
                </h2>
                <div className="text-xs text-gray-500">
                  {focusedSymbol ? `Focused on ${focusedSymbol}` : 'Select symbol from watchlist'}
                </div>
              </div>

              <div className="flex-1 mb-4">
                <h2 className="text-sm font-semibold mb-2">
                  Order Ticket {focusedSymbol && <span className="text-blue-600">({focusedSymbol})</span>}
                </h2>
                <div className="text-xs text-gray-500">
                  {focusedSymbol ? `Ready for ${focusedSymbol}` : 'Select symbol to trade'}
                </div>
              </div>

              <div className="flex-1">
                <h2 className="text-sm font-semibold mb-2">
                  HMM State Strip {focusedSymbol && <span className="text-blue-600">({focusedSymbol})</span>}
                </h2>
                <div className="text-xs text-gray-500">
                  {focusedSymbol ? `${focusedSymbol} state tracking` : 'Select symbol to see HMM state'}
                </div>
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-gray-400 transition-colors" />

          {/* Right Microcharts */}
          <Panel defaultSize={sizes.rightMicrocharts} minSize={15} maxSize={40}>
            <div className="h-full bg-gray-50 p-4">
              <h2 className="text-sm font-semibold mb-2">Microcharts</h2>
              <div className="text-xs text-gray-500">Coming soon...</div>
            </div>
          </Panel>
        </PanelGroup>
      </Panel>

      <PanelResizeHandle className="h-1 bg-gray-300 hover:bg-gray-400 transition-colors" />

      {/* Bottom Section */}
      <Panel defaultSize={sizes.bottom} minSize={15} maxSize={50}>
        <PanelGroup direction="horizontal" onLayout={(bottomSizes: number[]) => {
          updateSizes({
            tape: bottomSizes[0],
            ordersFillsPositions: bottomSizes[1],
          });
        }}>
          {/* Tape */}
          <Panel defaultSize={sizes.tape} minSize={30}>
            <div className="h-full bg-gray-50 p-4 border-r">
              <h2 className="text-sm font-semibold mb-2">Tape</h2>
              <div className="text-xs text-gray-500">Coming soon...</div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-gray-400 transition-colors" />

          {/* OrdersFillsPositions */}
          <Panel defaultSize={sizes.ordersFillsPositions} minSize={30}>
            <OrdersFillsPositions />
          </Panel>
        </PanelGroup>
      </Panel>

      <PanelResizeHandle className="h-1 bg-gray-300 hover:bg-gray-400 transition-colors" />

      {/* BottomBar */}
      <Panel defaultSize={sizes.bottomBar} minSize={5} maxSize={15}>
        <BottomBar />
      </Panel>
    </PanelGroup>
  );
}
