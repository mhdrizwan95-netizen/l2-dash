#!/usr/bin/env ts-node

import { Server } from 'http';
import { GuardrailCode } from '../src/lib/contracts';

const GUARDRAIL_CODES: GuardrailCode[] = ['SPREAD', 'POS', 'COOL', 'LAT', 'DD', 'KILL', 'CONF', 'DRIFT'];

const GUARDRAIL_MESSAGES = {
  SPREAD: 'Market spread exceeded 5bps threshold (current: 12bps)',
  POS: 'Position exposure hit 15% limit (max_position: $50k, current: $8k)',
  COOL: 'Trade frequency exceeded 40 TPS (58 TPS detected)',
  LAT: 'IBKR API latency >500ms (avg: 723ms) - initiating fast-path mode',
  DD: 'Daily drawdown reached -4.2% (-$2150) with $5000 threshold',
  KILL: 'Emergency kill activated - flattening all positions immediately',
  CONF: 'Model confidence dropped below 0.6 (current: 0.52) across 3+ symbols',
  DRIFT: 'Price drift detected: fair value vs market diff >3% (PLTR: +4.2%)'
};

function createGuardrailEvent(code: GuardrailCode, active: boolean) {
  const event = {
    event: 'guardrail',
    code,
    active,
    message: active ? GUARDRAIL_MESSAGES[code] : `${code} guardrail cleared - normal operations resumed`,
    timestamp: Date.now()
  };
  return `data: ${JSON.stringify(event)}\n\n`;
}

async function runDrill(code: GuardrailCode, server: Server): Promise<void> {
  return new Promise((resolve) => {
    console.log(`🏃 Starting ${code} guardrail drill...`);

    const triggerEvent = `data: ${JSON.stringify({
      event: 'guardrail',
      code,
      active: true,
      message: GUARDRAIL_MESSAGES[code],
      timestamp: Date.now()
    })}\n\n`;

    const clearEvent = `data: ${JSON.stringify({
      event: 'guardrail',
      code,
      active: false,
      message: `${code} guardrail cleared - normal operations resumed`,
      timestamp: Date.now() + 2000
    })}\n\n`;

    // Simulate SSE stream by writing to response
    server.on('request', (req, res) => {
      if (req.url === '/api/dev/sse') {
        setTimeout(() => {
          // Trigger guardrail
          res.write(triggerEvent);
          console.log(`⚡ ${code} guardrail TRIGGERED`);

          // Clear after 2 seconds
          setTimeout(() => {
            res.write(clearEvent);
            console.log(`✅ ${code} guardrail CLEARED`);
            resolve();
          }, 2000);
        }, 500);
      }
    });
  });
}

async function main() {
  console.log('🚀 L2 DASH Guardrail Drill Simulator');
  console.log('=====================================');
  console.log('');

  console.log('📋 Guardrail codes to test:', GUARDRAIL_CODES.join(', '));
  console.log('');

  // Simple HTTP server to simulate events being available to cockpit
  const server = require('http').createServer((req: any, res: any) => {
    if (req.url === '/api/dev/sse') {
      // Set SSE headers but don't complete response - we'll write events manually
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      console.log('📡 SSE connection established');
    } else {
      res.writeHead(404);
      res.end();
    }
  });


  server.listen(3003, () => {
    console.log('🌐 Test server running on http://localhost:3003');
    console.log('💡 Run: npm run dev (in another terminal) then visit /cockpit to see drills');
    console.log('');
  });

  // Run drill for each guardrail
  for (const code of GUARDRAIL_CODES) {
    await runDrill(code, server);
    console.log('');
  }

  console.log('🎯 All guardrail drills completed successfully!');
  console.log('📊 Expected results:');
  console.log('   - All 8 guardrail badges should have appeared in TopBar');
  console.log('   - Active guards should pulse red, inactive yellow/gray');
  console.log('   - Bottom log should show each trigger/clear message');
  console.log('');

  server.close(() => {
    console.log('🏁 Simulation complete - servers shut down');
    process.exit(0);
  });
}

main().catch(console.error);
