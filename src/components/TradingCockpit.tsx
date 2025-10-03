'use client';

import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export default function TradingCockpit() {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('is-dragging', dragging);
    return () => document.documentElement.classList.remove('is-dragging');
  }, [dragging]);

  return (
    <div className="h-screen w-screen overflow-hidden">
      <PanelGroup direction="vertical" onDragging={setDragging}>
        <Panel minSize={10} defaultSize={5}>
          <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
            {/* TopBar */}
          </div>
        </Panel>

        <PanelResizeHandle className="rp-handle" />

        <Panel minSize={30} defaultSize={65}>
          <PanelGroup direction="horizontal" onDragging={setDragging}>
            <Panel minSize={16} defaultSize={20}>
              <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
                {/* LeftWatchlist */}
              </div>
            </Panel>

            <PanelResizeHandle className="rp-handle" />

            <Panel minSize={36}>
              <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
                {/* Center (Ladder, OrderTicket, HMMStateStrip) */}
              </div>
            </Panel>

            <PanelResizeHandle className="rp-handle" />

            <Panel minSize={16} defaultSize={20}>
              <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
                {/* Right (Microcharts) */}
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="rp-handle" />

        <Panel minSize={12} defaultSize={30}>
          <div className="relative h-full w-full min-h-0 min-w-0 overflow-auto">{/* Bottom */}</div>
        </Panel>
      </PanelGroup>
    </div>
  );
}