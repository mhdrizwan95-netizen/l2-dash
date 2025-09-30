import { StrategyDefinition } from "./types";

const defaults = {
  upEnter: 0.60,
  downEnter: 0.60,
  exitTimeoutSec: 900,
};

const schema = {
  upEnter: { type: "number" as const, min: 0, max: 1, step: 0.01, label: "Up Enter ≥" },
  downEnter: { type: "number" as const, min: 0, max: 1, step: 0.01, label: "Down Enter ≥" },
  exitTimeoutSec: { type: "number" as const, min: 1, max: 86400, step: 1, label: "Exit Timeout (s)" },
};

const markovThreshold: StrategyDefinition<typeof defaults> = {
  id: "markov-threshold",
  name: "Markov Threshold",
  ui: { schema, defaults },
  async generateSignals(params, isoDate) {
    // Example: return empty for now
    return [];
  },
};

export default markovThreshold;
