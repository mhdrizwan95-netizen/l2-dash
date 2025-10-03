export const DISABLE_LEGACY_DASHBOARD = process.env.DISABLE_LEGACY_DASHBOARD === 'true';
export const USE_LEGACY = process.env.USE_LEGACY === 'true';
export const TRADING_MODE = process.env.TRADING_MODE || 'paper';
export const LIVE_QTY_CAP = parseInt(process.env.LIVE_QTY_CAP || '10', 10);
