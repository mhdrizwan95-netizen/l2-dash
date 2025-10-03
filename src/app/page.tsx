import L2Dashboard from '../components/L2Dashboard';
import TradingCockpit from '../components/layout/TradingCockpit';
import { USE_LEGACY } from '../lib/featureFlags';

export default function Page() {
  // If USE_LEGACY is enabled, show the legacy dashboard for rollback
  // Otherwise show the new cockpit as the default
  return USE_LEGACY ? <L2Dashboard /> : <TradingCockpit />;
}
