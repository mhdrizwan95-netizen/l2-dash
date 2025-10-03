'use client'

import { useEffect, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'

export default function PanelsTestPage() {
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('is-dragging', dragging)
    return () => document.documentElement.classList.remove('is-dragging')
  }, [dragging])

  return (
    <div className="h-screen w-screen overflow-hidden">
      <div className="p-4 bg-gray-100">
        <h1 className="text-2xl font-bold mb-2">Panels Library Test</h1>
        <p className="text-sm text-gray-600 mb-4">
          Testing react-resizable-panels v3.0.6 - Drag the thick handles below
        </p>

        <PanelGroup
          direction="horizontal"
          className="h-[400px] border-2 border-red-500"
        >
          <Panel defaultSize={33}>
            <div className="h-full bg-blue-100 flex items-center justify-center text-lg font-semibold">
              Left Panel (33%)
            </div>
          </Panel>

          <PanelResizeHandle className="rp-handle w-8 bg-green-500" />

          <Panel defaultSize={33}>
            <div className="h-full bg-green-100 flex items-center justify-center text-lg font-semibold">
              Center Panel (33%)
            </div>
          </Panel>

          <PanelResizeHandle className="rp-handle w-8 bg-blue-500" />

          <Panel defaultSize={34}>
            <div className="h-full bg-purple-100 flex items-center justify-center text-lg font-semibold">
              Right Panel (34%)
            </div>
          </Panel>
        </PanelGroup>

        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Vertical Test</h2>
        <PanelGroup
          direction="vertical"
          className="h-[400px] border-2 border-blue-500"
        >
            <Panel defaultSize={40}>
              <div className="h-full bg-red-100 flex items-center justify-center text-lg font-semibold">
                Top Panel (40%)
              </div>
            </Panel>

            <PanelResizeHandle className="rp-handle h-8 bg-purple-500" />

            <Panel defaultSize={60}>
              <div className="h-full bg-orange-100 flex items-center justify-center text-lg font-semibold">
                Bottom Panel (60%)
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </div>
  )
}
