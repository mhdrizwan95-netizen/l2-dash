'use client';

import React, { useEffect, useState } from 'react';
import { useDevSseClient } from '@/lib/devSseClient';
import { isSuggestExecEvent, SuggestExecEvent, FillEvent } from '@/lib/contracts';

// Suggestion item for display
interface SuggestionItem {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  timestamp: number;
  executed?: {
    at: number;
    reason?: string;
  };
}

// Position type - to be extended later
interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  unrealizedPnL: number;
}

export default function OrdersFillsPositions() {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [fills, setFills] = useState<FillEvent[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

  // Listen for suggestion and execution events
  useDevSseClient({
    onEvent: (event) => {
      if (event.event === 'suggest_exec' && isSuggestExecEvent(event)) {
        // Add new suggestion to recent list (keep last 10)
        setSuggestions(prev => {
          const newSuggestion: SuggestionItem = {
            id: event.id,
            symbol: event.symbol,
            side: event.side,
            qty: event.quantity,
            price: event.price,
            timestamp: event.timestamp,
          };
          const updated = [newSuggestion, ...prev].slice(0, 10);
          return updated;
        });

        // Check if this suggestion matches a recent one that wasn't executed
        setSuggestions(prev =>
          prev.map(suggestion => {
            // Match by similar attributes (this will be refined)
            if (suggestion.symbol === event.symbol &&
                suggestion.side === event.side &&
                Math.abs(suggestion.price - event.price) < 0.01) {
              // Mark as executed with reason if executed
              return {
                ...suggestion,
                executed: {
                  at: Date.now(),
                  reason: event.executed ? 'EXECUTED' : event.reason || 'PENDING'
                }
              };
            }
            return suggestion;
          })
        );
      }
    },
  });

  // Format timestamp for display
  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour12: false });
  };

  return (
    <div className="h-full bg-white p-3 font-mono text-xs">
      <h2 className="text-sm font-bold mb-3 text-gray-800">Orders | Fills | Positions</h2>

      {/* Recent Suggestions */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold mb-2 text-gray-600">Recent Suggestions</h3>
        <div className="space-y-1 border rounded p-2 max-h-32 overflow-y-auto">
          {suggestions.length === 0 ? (
            <div className="text-gray-400 italic">No suggestions yet</div>
          ) : (
            suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`flex justify-between items-center py-1 px-2 rounded text-xs ${
                  suggestion.executed
                    ? suggestion.executed.reason === 'EXECUTED'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-yellow-50 text-yellow-700'
                    : 'bg-blue-50 text-blue-700'
                }`}
              >
                <div className="flex-1">
                  <span className="font-semibold">{suggestion.symbol}</span>
                  <span className={`ml-1 px-1 py-0.5 rounded text-xs font-bold ${
                    suggestion.side === 'BUY' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                  }`}>
                    {suggestion.side}
                  </span>
                  <span className="ml-2 text-gray-600">
                    {suggestion.qty}@{suggestion.price.toFixed(2)}
                  </span>
                </div>
                <div className="text-right">
                  {suggestion.executed ? (
                    <span className="text-xs">
                      {suggestion.executed.reason === 'EXECUTED' ? '✓' : '✗'} {formatTime(suggestion.executed.at)}
                    </span>
                  ) : (
                    <span className="text-gray-500">{formatTime(suggestion.timestamp)}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Fills Section - Placeholder */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold mb-2 text-gray-600">Fills</h3>
        <div className="text-gray-400 italic">Coming soon...</div>
      </div>

      {/* Positions Section - Placeholder */}
      <div>
        <h3 className="text-xs font-semibold mb-2 text-gray-600">Positions</h3>
        <div className="text-gray-400 italic">Coming soon...</div>
      </div>
    </div>
  );
}
