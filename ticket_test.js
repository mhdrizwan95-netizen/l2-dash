// Test script for M8-T8.1 live mode caps & canary overlays
const { brokerClient } = require('./src/lib/brokerClient.ts');

// Test live mode quantity cap
async function testLiveModeCap() {
  console.log('Testing live mode quantity cap...');

  try {
    // This should work in paper mode (default)
    await brokerClient.placeOrder({
      symbol: 'AAPL',
      side: 'BUY',
      qty: 5, // Within cap
      type: 'MKT'
    });
    console.log('✓ Small order accepted in paper mode');
  } catch (error) {
    console.log('✗ Unexpected error for small order:', error.message);
  }

  // With live mode enabled, large order should be rejected
  const originalMode = process.env.TRADING_MODE;
  process.env.TRADING_MODE = 'live';

  try {
    // Force reload of module to pick up new env var
    delete require.cache[require.resolve('./src/lib/brokerClient.ts')];
    delete require.cache[require.resolve('./src/lib/featureFlags.ts')];
    const brokerClientLive = require('./src/lib/brokerClient.ts').brokerClient;

    await brokerClientLive.placeOrder({
      symbol: 'AAPL',
      side: 'BUY',
      qty: 15, // Exceeds cap of 10
      type: 'MKT'
    });
    console.log('✗ Large order unexpectedly accepted in live mode');
  } catch (error) {
    if (error.code === 'LIVE_QTY_CAP_EXCEEDED') {
      console.log('✓ Large order correctly rejected in live mode:', error.message);
    } else {
      console.log('✗ Unexpected error:', error.message);
    }
  } finally {
    process.env.TRADING_MODE = originalMode;
  }
}

testLiveModeCap();
