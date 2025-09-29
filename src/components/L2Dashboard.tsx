'use client';

/**
 * L2 Paper Trading Dashboard
 * React + Tailwind + shadcn/ui + lucide-react + recharts
 * Drop-in component for src/components/L2Dashboard.tsx
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";
import {
  Activity,
  Play,
  Square,
  Settings2,
  Clock,
  Database,
  PlugZap,
  TrendingUp,
  ShieldAlert,
  FileDown,
  CandlestickChart,
} from "lucide-react";
import { useLiveStream } from "@/hooks/useLiveStream"; // optional SSE backend hookup

/* ------------------------- Types ------------------------- */

type StreamEvent = {
  ts: number;      // epoch seconds
  mid: number;
  spreadBp: number;
  imb: number;     // order book imbalance
  state: number;   // HMM state id
  action?: "buy" | "sell" | "hold";
};

type Trade = {
  id: string;
  ts: number;
  side: "BUY" | "SELL";
  qty: number;
  px: number;          // paper fill price
  pxShadow?: number;   // shadow (queue-aware) fill price
  slippage?: number;
  pnl?: number;
  stateAtEntry?: number;
};

type Metrics = {
  hitRate: number;             // 0..1
  sharpeLike: number;
  avgEdgeTicks: number;
  conservativeEdgeTicks: number;
  pnl: number;
  pnlShadow: number;
  trades: number;
  maxDD: number;
  latencyMsObserved: number;
};

/* ---------------------- Utilities ------------------------ */

const fmtPct = (x: number) => `${(x * 100).toFixed(1)}%`;
const fmt2 = (x: number) => x.toFixed(2);
const nowSec = () => Math.floor(Date.now() / 1000);

/* --------------------- Mock stream ----------------------- */

function useMockStream(enabled: boolean, enqueueEvent: (e: StreamEvent) => void) {
  useEffect(() => {
    if (!enabled) return;
    let t = 0;
    const id = setInterval(() => {
      t += 1;
      const mid = 100 + Math.sin(t / 15) * 0.5 + (Math.random() - 0.5) * 0.05;
      const spreadBp = 0.6 + Math.abs(Math.sin(t / 20)) * 0.6; // 0.6..1.2
      const imb = Math.max(
        -0.8,
        Math.min(0.8, Math.sin(t / 10) + (Math.random() - 0.5) * 0.4)
      );
      const state = imb > 0.25 ? 0 : imb < -0.25 ? 2 : 1; // 0=buy-pressure,1=calm,2=sell-pressure
      const action =
        state === 0 && spreadBp < 0.9
          ? Math.random() < 0.3
            ? "buy"
            : "hold"
          : state === 2 && spreadBp < 0.9
          ? Math.random() < 0.3
            ? "sell"
            : "hold"
          : "hold";
      enqueueEvent({ ts: nowSec(), mid, spreadBp, imb, state, action });
    }, 200);
    return () => clearInterval(id);
  }, [enabled, enqueueEvent]);
}

/* ------------------- Main Component ---------------------- */

export default function L2PaperTradingDashboard() {
  const [tab, setTab] = useState("dashboard");
  const [symbol, setSymbol] = useState("AAPL");
  const [connected, setConnected] = useState(false);
  const [useMock, setUseMock] = useState(true);

  // Strategy params
  const [imbThresh, setImbThresh] = useState(0.25);
  const [spreadMaxBp, setSpreadMaxBp] = useState(1.0);
  const [latencyMs, setLatencyMs] = useState(60);
  const [retrainSec, setRetrainSec] = useState(1800);
  const [maxPos, setMaxPos] = useState(100);
  const [stateMap, setStateMap] = useState<{ [k: number]: string }>({
    0: "buy_pressure",
    1: "calm",
    2: "sell_pressure",
  });
  const [policyJson, setPolicyJson] = useState(`{
  "buy_pressure": {"aggressiveLong": true, "minImbalance": 0.25, "maxSpreadBp": 1.0},
  "calm": {"passive": true},
  "sell_pressure": {"aggressiveShort": true, "minImbalance": -0.25, "maxSpreadBp": 1.0}
}`);

  // Streaming buffers
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [metrics] = useState<Metrics>({
    hitRate: 0.54,
    sharpeLike: 1.1,
    avgEdgeTicks: 0.42,
    conservativeEdgeTicks: 0.18,
    pnl: 1250.3,
    pnlShadow: 410.8,
    trades: 248,
    maxDD: -320.5,
    latencyMsObserved: 58,
  });
  const [equity, setEquity] = useState<{ t: number; eq: number }[]>([]);

  // In-memory appenders
  const enqueueEvent = (e: StreamEvent) => {
    setEvents((prev) =>
      prev.length > 2000 ? [...prev.slice(-2000), e] : [...prev, e]
    );
  };
  const addTrade = (tr: Trade) => setTrades((p) => [tr, ...p].slice(0, 500));
  const pushEquityPoint = (eq: number) =>
    setEquity((p) => [...p.slice(-1000), { t: nowSec(), eq }]);

  // Mock stream hookup
  useMockStream(connected && useMock, enqueueEvent);

  // Live stream hookup (SSE backend) — only runs when Mock is OFF
  useLiveStream(connected && !useMock, {
    onTick: (p) =>
      enqueueEvent({
        ts: p.ts,
        mid: p.mid,
        spreadBp: p.spreadBp,
        imb: p.imb,
        state: p.state,
      }),
    onFill: (f) => {
      // Minimal demo: we don't track order sides here; mark as BUY
      addTrade({
        id: f.orderId,
        ts: f.ts,
        side: "BUY",
        qty: f.qty,
        px: f.px,
        pxShadow: f.kind === "shadow" ? f.px : undefined,
      });
    },
  });

  // Derivations
  const last = events[events.length - 1];
  const signalRate = useMemo(() => {
    const recent = events.slice(-300);
    return (
      recent.filter((e) => e.action && e.action !== "hold").length /
      Math.max(1, recent.length)
    );
  }, [events]);

  // Demo: synthesize trades/equity when mock actions fire
  useEffect(() => {
    if (!last || !useMock) return;
    if (last.action && last.action !== "hold") {
      const side = last.action === "buy" ? "BUY" : "SELL";
      const qty = 10;
      const paperPx = last.mid + (side === "BUY" ? 0.01 : -0.01);
      const shadowPx = paperPx + (side === "BUY" ? 0.01 : -0.01); // 1 extra tick slippage
      const pnl = (side === "BUY" ? -0.01 : 0.01) * qty; // placeholder
      addTrade({
        id: crypto.randomUUID(),
        ts: last.ts,
        side,
        qty,
        px: paperPx,
        pxShadow: shadowPx,
        pnl,
        stateAtEntry: last.state,
      });
      const lastEq = equity.length ? equity[equity.length - 1].eq : 100000;
      pushEquityPoint(lastEq + pnl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  // Connect/disconnect (placeholder)
  const toggleConnect = () => setConnected((c) => !c);

  // Export CSV
  const exportCSV = () => {
    const rows = trades.map((t) => ({
      ts: new Date(t.ts * 1000).toISOString(),
      side: t.side,
      qty: t.qty,
      px: t.px,
      pxShadow: t.pxShadow ?? "",
      pnl: t.pnl ?? "",
      stateAtEntry: t.stateAtEntry ?? "",
    }));
    const header = Object.keys(rows[0] || { a: "" }).join(",");
    const body = rows.map((r) => Object.values(r).join(",")).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades_${symbol}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Charts data
  const chartData = useMemo(
    () =>
      events.slice(-300).map((e, i) => ({
        idx: i,
        mid: e.mid,
        spreadBp: e.spreadBp,
        imb: e.imb,
        state: e.state,
      })),
    [events]
  );

  // UI helpers
  const MetricCard = ({
    label,
    value,
    icon: Icon,
  }: {
    label: string;
    value: string;
    icon: React.ComponentType<{ className?: string }>;
  }) => (
    <Card className="shadow-sm">
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className="h-5 w-5" />
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CandlestickChart className="h-6 w-6" />
          <h1 className="text-xl font-bold">L2 Paper Trading — {symbol}</h1>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              connected
                ? "bg-emerald-100 text-emerald-700"
                : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {connected ? "LIVE" : "DISCONNECTED"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={useMock} onCheckedChange={setUseMock} />
          <span className="text-sm">Mock stream</span>
          <Button
            variant={connected ? "destructive" : "default"}
            onClick={toggleConnect}
            className="gap-2"
          >
            {connected ? (
              <Square className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {connected ? "Stop" : "Start"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="strategy">Strategy</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Symbol</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="h-9"
                />
                <Button variant="secondary">Subscribe</Button>
              </CardContent>
            </Card>
            <MetricCard
              label="Signal rate (5m)"
              value={fmtPct(signalRate)}
              icon={Activity}
            />
            <MetricCard
              label="Observed latency"
              value={`${metrics.latencyMsObserved} ms`}
              icon={Clock}
            />
            <MetricCard
              label="Connection"
              value={connected ? "Live" : "Offline"}
              icon={PlugZap}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Mid Price & States</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="idx" tick={false} />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="mid"
                      dot={false}
                      strokeWidth={1.5}
                    />
                    {/* encode state as area */}
                    <Area type="monotone" dataKey="state" yAxisId={1} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Order Book Imbalance</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="idx" tick={false} />
                    <YAxis domain={[-1, 1]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="imb" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Spread (bp)</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" tick={false} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="spreadBp" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STRATEGY */}
        <TabsContent value="strategy" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Policy (JSON)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={policyJson}
                  onChange={(e) => setPolicyJson(e.target.value)}
                  className="min-h-[280px] font-mono text-sm"
                />
                <div className="mt-2 flex gap-2">
                  <Button variant="secondary" className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    Validate
                  </Button>
                  <Button className="gap-2">
                    <Play className="h-4 w-4" />
                    Apply
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Imbalance threshold: {fmt2(imbThresh)}</Label>
                  <Slider
                    defaultValue={[imbThresh]}
                    min={0}
                    max={0.8}
                    step={0.01}
                    onValueChange={(v) => setImbThresh(v[0])}
                  />
                </div>
                <div>
                  <Label>Max spread (bp): {fmt2(spreadMaxBp)}</Label>
                  <Slider
                    defaultValue={[spreadMaxBp]}
                    min={0.2}
                    max={5}
                    step={0.1}
                    onValueChange={(v) => setSpreadMaxBp(v[0])}
                  />
                </div>
                <div>
                  <Label>Latency (ms)</Label>
                  <Input
                    type="number"
                    value={latencyMs}
                    onChange={(e) => setLatencyMs(parseInt(e.target.value || "0"))}
                  />
                </div>
                <div>
                  <Label>Retrain cadence (sec)</Label>
                  <Input
                    type="number"
                    value={retrainSec}
                    onChange={(e) =>
                      setRetrainSec(parseInt(e.target.value || "0"))
                    }
                  />
                </div>
                <div>
                  <Label>Max position</Label>
                  <Input
                    type="number"
                    value={maxPos}
                    onChange={(e) => setMaxPos(parseInt(e.target.value || "0"))}
                  />
                </div>
                <div>
                  <Label>State mapping</Label>
                  <Select
                    value={stateMap[0]}
                    onValueChange={(v) => setStateMap({ ...stateMap, 0: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy_pressure">buy_pressure</SelectItem>
                      <SelectItem value="calm">calm</SelectItem>
                      <SelectItem value="sell_pressure">sell_pressure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Controls</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button className="gap-2">
                <Play className="h-4 w-4" />
                Start Strategy
              </Button>
              <Button variant="destructive" className="gap-2">
                <Square className="h-4 w-4" />
                Stop Strategy
              </Button>
              <Button variant="secondary" className="gap-2">
                <Database className="h-4 w-4" />
                Retrain HMM
              </Button>
              <Button variant="outline" className="gap-2" onClick={exportCSV}>
                <FileDown className="h-4 w-4" />
                Export trades CSV
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RESULTS */}
        <TabsContent value="results" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              label="Hit rate"
              value={fmtPct(metrics.hitRate)}
              icon={TrendingUp}
            />
            <MetricCard
              label="PnL (paper)"
              value={`$${fmt2(metrics.pnl)}`}
              icon={Activity}
            />
            <MetricCard
              label="PnL (shadow)"
              value={`$${fmt2(metrics.pnlShadow)}`}
              icon={ShieldAlert}
            />
            <MetricCard
              label="# Trades"
              value={`${metrics.trades}`}
              icon={Database}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Equity Curve</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={equity.map((p, i) => ({ idx: i, eq: p.eq }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="idx" tick={false} />
                    <YAxis domain={["auto", "auto"]} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="eq"
                      dot={false}
                      strokeWidth={1.5}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Edge (ticks)</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Avg Edge", val: metrics.avgEdgeTicks },
                      { name: "Conservative", val: metrics.conservativeEdgeTicks },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="val" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recent Trades</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2">Time</th>
                    <th>Side</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Shadow Px</th>
                    <th>PnL</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.slice(0, 50).map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="py-1">
                        {new Date(t.ts * 1000).toLocaleTimeString()}
                      </td>
                      <td className={t.side === "BUY" ? "text-emerald-600" : "text-red-600"}>
                        {t.side}
                      </td>
                      <td>{t.qty}</td>
                      <td>{fmt2(t.px)}</td>
                      <td>{t.pxShadow ? fmt2(t.pxShadow) : "-"}</td>
                      <td className={(t.pnl ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"}>
                        {t.pnl ? fmt2(t.pnl) : "-"}
                      </td>
                      <td>{t.stateAtEntry ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <footer className="text-xs text-muted-foreground pt-2">
        API contract (expected): WS/SSE emits {"{ts, mid, spreadBp, imb, state, action?}"}.
        Orders POST /api/order. Fills via /api/fill. Shadow simulator runs server-side; send both paper and shadow fills to the Results tab.
      </footer>
    </div>
  );
}
