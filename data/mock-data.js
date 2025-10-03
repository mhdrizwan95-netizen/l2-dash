// Mock data generator for L2 Dashboard
// Run with: node data/mock-data.js

const fs = require('fs');
const path = require('path');

// Create mock telemetry data
const mockData = {
  positions: {
    AAPL: {
      symbol: "AAPL",
      qty: 100,
      avgPx: 254.23,
      realizedPnL: 1250.50,
      sector: "Technology",
      mktPx: 256.78,
      lastFillTs: "2025-10-01T06:15:00.000Z"
    },
    MSFT: {
      symbol: "MSFT",
      qty: 50,
      avgPx: 418.90,
      realizedPnL: 892.30,
      sector: "Technology",
      mktPx: 421.45,
      lastFillTs: "2025-10-01T05:30:00.000Z"
    },
    NVDA: {
      symbol: "NVDA",
      qty: -25,
      avgPx: 145.20,
      realizedPnL: 210.75,
      sector: "Technology",
      mktPx: 142.80,
      lastFillTs: "2025-10-01T04:45:00.000Z"
    }
  },

  ticks: {
    AAPL: {
      symbol: "AAPL",
      price: 256.78,
      timestamp: Date.now() - 1000,
      volume: 1250000
    },
    MSFT: {
      symbol: "MSFT",
      price: 421.45,
      timestamp: Date.now() - 2000,
      volume: 780000
    },
    NVDA: {
      symbol: "NVDA",
      price: 142.80,
      timestamp: Date.now() - 1500,
      volume: 2100000
    },
    SPY: {
      symbol: "SPY",
      price: 572.30,
      timestamp: Date.now() - 500,
      volume: 15000000
    }
  },

  guardrails: [
    {
      rule: "DD",
      level: "WARN",
      message: "3.2%",
      timestamp: Date.now() - 30000
    },
    {
      rule: "POSITION",
      level: "OK",
      message: "Max position size OK",
      timestamp: Date.now() - 20000
    }
  ],

  markov: {
    state: 1,
    stateLabel: "Bull Momentum",
    confidence: 0.85,
    entropy: 0.32,
    timeInStateSec: 180,
    probs: [0.12, 0.85, 0.03]
  },

  fills: [
    {
      ts: Date.now() - 60000,
      symbol: "AAPL",
      side: "BUY",
      qty: 10,
      price: 256.45,
      pnl: 122.00
    },
    {
      ts: Date.now() - 120000,
      symbol: "MSFT",
      side: "BUY",
      qty: 5,
      price: 420.80,
      pnl: 32.50
    }
  ]
};

// Write mock data as JSON
fs.writeFileSync(
  path.join(__dirname, 'mock-telemetry.json'),
  JSON.stringify(mockData, null, 2)
);

console.log('✅ Mock telemetry data generated in data/mock-telemetry.json');
console.log('\n📊 Sample data includes:');
console.log('• 3 positions (AAPL, MSFT, NVDA)');
console.log('• 4 tick prices');
console.log('• 2 guardrail events');
console.log('• HMM state data');
console.log('• Recent fills');

// Create summary
const summary = {
  totalPnL: Object.values(mockData.positions).reduce((a, p) => a + p.realizedPnL, 0),
  symbols: Object.keys(mockData.ticks),
  activePositions: Object.keys(mockData.positions)
};

console.log('\n📈 Dashboard Summary:');
console.log(`   Total PnL: $${summary.totalPnL.toFixed(2)}`);
console.log(`   Active Symbols: ${summary.symbols.join(', ')}`);
console.log(`   Positions: ${summary.activePositions.join(', ')}`);
