'use client';
import { useState } from 'react';
import { useStrategyStore } from '@/lib/strategyStore';

export function SettingsDrawer() {
const { settings, setSettings } = useStrategyStore();
const [open, setOpen] = useState(false);
const [form, setForm] = useState(settings);
const apply = () => { setSettings(form); setOpen(false); };
return (
<>
<button onClick={() => setOpen(true)} className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm">IBKR Settings</button>
{open && (
<div className="fixed inset-0 bg-black/50 grid place-items-center z-50">
<div className="w-[560px] bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-2xl">
<h2 className="text-lg font-medium mb-4">IBKR Connection</h2>
<div className="grid grid-cols-2 gap-4">
<label className="text-sm">Host
<input className="mt-1 w-full bg-zinc-800 rounded-lg p-2" value={form.host} onChange={e=>setForm({...form,host:e.target.value})}/>
</label>
<label className="text-sm">Port
<input type="number" className="mt-1 w-full bg-zinc-800 rounded-lg p-2" value={form.port} onChange={e=>setForm({...form,port:parseInt(e.target.value||'0')})}/>
</label>
<label className="text-sm">Client ID
<input type="number" className="mt-1 w-full bg-zinc-800 rounded-lg p-2" value={form.clientId} onChange={e=>setForm({...form,clientId:parseInt(e.target.value||'0')})}/>
</label>
<label className="text-sm">Account (opt)
<input className="mt-1 w-full bg-zinc-800 rounded-lg p-2" value={form.account||''} onChange={e=>setForm({...form,account:e.target.value})}/>
</label>
<label className="col-span-2 text-sm">Ingest Secret (recommended)
<input className="mt-1 w-full bg-zinc-800 rounded-lg p-2" value={form.ingestKey||''} onChange={e=>setForm({...form,ingestKey:e.target.value})} placeholder="shared secret used by ib_bridge -> /api/ingest"/>
</label>
</div>
<div className="mt-5 flex gap-2 justify-end">
<button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg bg-zinc-800">Cancel</button>
<button onClick={apply} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500">Save</button>
</div>
</div>
</div>
)}
</>
);
}