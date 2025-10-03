import React, { useState, useEffect } from 'react';
import { loadLocal, setIncludeSymbol } from '@/lib/persist/analytics';

export function Settings() {
  const [includeSymbol, setIncludeSymbolState] = useState(
    () => loadLocal<boolean>("dash:v2:settings:includeSymbol") ?? false
  );

  useEffect(() => {
    setIncludeSymbol(includeSymbol);
  }, [includeSymbol]);

  return (
    <div className="bg-white shadow rounded p-4 mb-4">
      <h3 className="text-lg font-semibold mb-2">Persistence Settings</h3>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="includeSymbol"
          checked={includeSymbol}
          onChange={(e) => setIncludeSymbolState(e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="includeSymbol" className="text-sm font-medium">
          Include Symbol in Layout Persistence
        </label>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        When enabled, layout settings will be saved per symbol. Default: off.
      </p>
    </div>
  );
}
