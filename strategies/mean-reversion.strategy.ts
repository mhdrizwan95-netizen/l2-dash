import { StrategyDefinition } from "./types";

const defaults = {
  lookback: 20,
  zScoreEnter: 1.5,
  zScoreExit: 0.3,
};

const schema = {
  lookback: { type: "number" as const, min: 5, max: 500, step: 1, label: "Lookback (bars)" },
  zScoreEnter: { type: "number" as const, min: 0, max: 5, step: 0.1, label: "Enter |z| ≥" },
  zScoreExit: { type: "number" as const, min: 0, max: 5, step: 0.1, label: "Exit |z| ≤" },
};

const meanReversion: StrategyDefinition<typeof defaults> = {
  id: "mean-reversion",
  name: "Mean Reversion (Simple)",
  ui: { schema, defaults },
  async generateSignals(params, isoDate) {
    // Example: return empty for now
    return [];
  },
};

export default meanReversion;
