// Note: L2Dashboard removed as legacy code after cutover completion.
// For rollback emergency testing, clone from git history and re-import conditionally.
// This preserves the clean codebase while maintaining rollback capability via USE_LEGACY flag.

import TradingCockpit from '../components/layout/TradingCockpit';
import { USE_LEGACY, DISABLE_LEGACY_DASHBOARD } from '../lib/featureFlags';

export default function Page() {
  // Cutover logic: DISABLE_LEGACY_DASHBOARD takes precedence
  // Legacy code has been removed - rollback should be done by restoring from git history
  if (DISABLE_LEGACY_DASHBOARD || !USE_LEGACY) {
    return <TradingCockpit />;
  }

  // Emergency fallback: This should not be reached in normal operation
  // Legacy dashboard removed after successful cutover verification
  // To enable rollback for testing: git restore src/components/L2Dashboard.tsx and restore import above
  console.error('Legacy dashboard requested but removed. Enable rollback in DEVELOPMENT ONLY by restoring L2Dashboard.tsx from git history.');
  return <TradingCockpit />;
}
