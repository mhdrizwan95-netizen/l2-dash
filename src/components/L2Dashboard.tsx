// src/components/L2Dashboard.tsx
'use client';
import { useEffect } from 'react';
import { useStrategyStore } from '@/lib/strategyStore';
import StrategyGrid from './StrategyGrid';
import { SettingsDrawer } from './SettingsDrawer';

export default function L2Dashboard() {
  const boot = useStrategyStore(s => s.bootFromStorage);

  useEffect(() => {
    boot();
  }, [boot]);

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Level-2 Markov — Strategies</h1>
          <SettingsDrawer />
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        <StrategyGrid />
      </main>
    </div>
  );
}
