// src/app/page.tsx
'use client';

import { SettingsDrawer } from '@/components/SettingsDrawer';
import { StrategyGrid } from '@/components/StrategyGrid';
import { useEffect } from 'react';
import { useStrategyStore } from '@/lib/strategyStore';

export default function Page() {
  const boot = useStrategyStore(s => s.bootFromStorage);
  useEffect(() => { boot(); }, [boot]);

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Trading Control Room</h1>
        <SettingsDrawer/>
      </header>
      <StrategyGrid/>
    </main>
  );
}
