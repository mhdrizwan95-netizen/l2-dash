"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const defaults = {
    upEnter: 0.60,
    downEnter: 0.60,
    exitTimeoutSec: 900,
};
const schema = {
    upEnter: { type: "number", min: 0, max: 1, step: 0.01, label: "Up Enter ≥" },
    downEnter: { type: "number", min: 0, max: 1, step: 0.01, label: "Down Enter ≥" },
    exitTimeoutSec: { type: "number", min: 1, max: 86400, step: 1, label: "Exit Timeout (s)" },
};
const markovThreshold = {
    id: "markov-threshold",
    name: "Markov Threshold",
    ui: { schema, defaults },
    async generateSignals(params, isoDate) {
        // Example: return empty for now
        return [];
    },
};
exports.default = markovThreshold;
