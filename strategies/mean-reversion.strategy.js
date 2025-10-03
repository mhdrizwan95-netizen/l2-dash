"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const defaults = {
    lookback: 20,
    zScoreEnter: 1.5,
    zScoreExit: 0.3,
};
const schema = {
    lookback: { type: "number", min: 5, max: 500, step: 1, label: "Lookback (bars)" },
    zScoreEnter: { type: "number", min: 0, max: 5, step: 0.1, label: "Enter |z| ≥" },
    zScoreExit: { type: "number", min: 0, max: 5, step: 0.1, label: "Exit |z| ≤" },
};
const meanReversion = {
    id: "mean-reversion",
    name: "Mean Reversion (Simple)",
    ui: { schema, defaults },
    async generateSignals(params, isoDate) {
        // Example: return empty for now
        return [];
    },
};
exports.default = meanReversion;
