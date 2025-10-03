'use client'

import MarkovPanel from '../MarkovPanel'
import ErrorBoundaryCatch from '../ErrorBoundaryCatch'

export default function CenterTrading() {
  return (
    <div className="relative h-full w-full min-h-0 min-w-0 overflow-hidden">
      <ErrorBoundaryCatch>
        <MarkovPanel />
      </ErrorBoundaryCatch>
    </div>
  )
}
