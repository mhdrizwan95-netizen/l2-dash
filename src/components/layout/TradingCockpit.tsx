'use client'

import { useEffect, useState } from 'react'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import ErrorBoundaryCatch from '../ErrorBoundaryCatch'
import { TopBar } from '../panes/TopBar'
import LeftWatchlist from '../panes/LeftWatchlist'
import CenterTrading from '../center/CenterTrading'
import { PerformanceChart } from '../PerformanceChart'
import OrdersFillsPositions from '../panes/OrdersFillsPositions'

export default function TradingCockpit() {
  // Symbol focus management (needed for LeftWatchlist)
  const [focusedSymbol, setFocusedSymbol] = useState<string | null>('AAPL')
  const handleSymbolFocus = (symbol: string) => {
    setFocusedSymbol(symbol)
  }

  // Dragging state for smooth resize experience
  const [dragging, setDragging] = useState(false)

  const handleDragStart = () => setDragging(true)
  const handleDragEnd = () => setDragging(false)

  useEffect(() => {
    document.documentElement.classList.toggle('is-dragging', dragging)
    return () => document.documentElement.classList.remove('is-dragging')
  }, [dragging])

  // Avoid SSR/CSR size mismatch: render panels only after mount
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])

  // Server render: show stable placeholder with real height
  if (!isClient) {
    return (
      <div className="h-screen w-screen grid place-items-center">
        <div className="text-sm opacity-70">Loading cockpit…</div>
      </div>
    )
  }

  // Client render: FULL layout with defaultSize on EVERY Panel
  return (
    <div className="h-screen w-screen overflow-hidden">
      <PanelGroup direction="vertical">
        <Panel minSize={10} defaultSize={12} collapsible={false}>
          <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
            <ErrorBoundaryCatch>
              <TopBar />
            </ErrorBoundaryCatch>
          </div>
        </Panel>

        <PanelResizeHandle
          className="rp-handle"
          onDragging={dragging => {
            setDragging(dragging)
          }}
        />

        <Panel minSize={30} defaultSize={68} collapsible={false}>
          <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
            <PanelGroup direction="horizontal">
              <Panel minSize={18} defaultSize={24} collapsible={false}>
                <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
                  <ErrorBoundaryCatch>
                    <LeftWatchlist onSymbolFocus={handleSymbolFocus} focusedSymbol={focusedSymbol} />
                  </ErrorBoundaryCatch>
                </div>
              </Panel>

              <PanelResizeHandle
                className="rp-handle"
                onDragging={dragging => {
                  setDragging(dragging)
                }}
              />

              <Panel minSize={45} defaultSize={52} collapsible={false}>
                <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
                  <ErrorBoundaryCatch>
                    <CenterTrading />
                  </ErrorBoundaryCatch>
                </div>
              </Panel>

              <PanelResizeHandle
                className="rp-handle"
                onDragging={dragging => {
                  setDragging(dragging)
                }}
              />

              <Panel minSize={18} defaultSize={24} collapsible={false}>
                <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
                  <ErrorBoundaryCatch>
                    <PerformanceChart symbol={focusedSymbol ?? undefined} />
                  </ErrorBoundaryCatch>
                </div>
              </Panel>
            </PanelGroup>
          </div>
        </Panel>

        <PanelResizeHandle
          className="rp-handle"
          onDragging={dragging => {
            setDragging(dragging)
          }}
        />

        <Panel minSize={12} defaultSize={20} collapsible={false}>
          <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
            <ErrorBoundaryCatch>
              <OrdersFillsPositions />
            </ErrorBoundaryCatch>
          </div>
        </Panel>

      </PanelGroup>
    </div>
  )
}
