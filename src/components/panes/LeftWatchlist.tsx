import React, { useEffect, useState } from 'react';

// Mock data for watchlist
const mockWatchlist = [
  { symbol: 'AAPL', delta: 1.2, spread: 2.1, hmmState: 'BUY' },
  { symbol: 'GOOGL', delta: -0.5, spread: 1.8, hmmState: 'HOLD' },
  { symbol: 'MSFT', delta: 0.8, spread: 2.3, hmmState: 'SELL' },
  { symbol: 'TSLA', delta: -1.1, spread: 1.9, hmmState: 'BUY' },
  { symbol: 'NVDA', delta: 2.0, spread: 2.5, hmmState: 'HOLD' },
  { symbol: 'META', delta: 0.3, spread: 1.6, hmmState: 'SELL' },
];

interface WatchlistItem {
  symbol: string;
  delta: number;
  spread: number;
  hmmState: 'BUY' | 'HOLD' | 'SELL';
}

interface LeftWatchlistProps {
  onSymbolFocus: (symbol: string) => void;
  focusedSymbol: string | null;
}

export default function LeftWatchlist({ onSymbolFocus, focusedSymbol }: LeftWatchlistProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Update selected index when focused symbol changes
  useEffect(() => {
    if (focusedSymbol) {
      const index = mockWatchlist.findIndex(item => item.symbol === focusedSymbol);
      if (index !== -1) {
        setSelectedIndex(index);
      }
    }
  }, [focusedSymbol]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target !== document.body) return; // Only handle when focused on body

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => Math.min(mockWatchlist.length - 1, prev + 1));
          break;
        case 'Enter':
          event.preventDefault();
          const selectedItem = mockWatchlist[selectedIndex];
          if (selectedItem) {
            onSymbolFocus(selectedItem.symbol);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, onSymbolFocus]);

  const getHMMStateColor = (state: string) => {
    switch (state) {
      case 'BUY': return 'text-green-400';
      case 'SELL': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-sm font-semibold mb-2 px-4 pt-4">Watchlist</h2>

      <div className="flex-1 overflow-auto">
        {/* Table Header */}
        <div className="flex text-xs font-medium text-gray-400 border-b border-gray-600 px-4 py-2 mb-1">
          <div className="flex-1">Symbol</div>
          <div className="w-14 text-right">Δ</div>
          <div className="w-12 text-right">Spr</div>
          <div className="w-12 text-center">HMM</div>
        </div>

        {/* Table Rows */}
        {mockWatchlist.map((item, index) => (
          <div
            key={item.symbol}
            className={`flex text-xs px-4 py-1 cursor-pointer hover:bg-gray-700 rounded mx-1 ${
              index === selectedIndex ? 'bg-blue-600 text-white' : 'text-gray-300'
            }`}
            onClick={() => {
              setSelectedIndex(index);
              onSymbolFocus(item.symbol);
            }}
          >
            <div className="flex-1 font-mono">{item.symbol}</div>
            <div className={`w-14 text-right ${item.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {item.delta > 0 ? '+' : ''}{item.delta.toFixed(1)}
            </div>
            <div className="w-12 text-right text-blue-300">
              {item.spread.toFixed(1)}
            </div>
            <div className={`w-12 text-center font-bold ${getHMMStateColor(item.hmmState)}`}>
              {item.hmmState}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-600">
        ↑↓ Navigate • Enter Focus
      </div>
    </div>
  );
}
