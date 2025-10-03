export type ControlCommandKind =
  | 'set_trading_mode'
  | 'kill_switch'
  | 'flatten_all'
  | 'rebuild_universe'
  | 'heartbeat';

export interface ControlCommand {
  kind: ControlCommandKind;
  ts: number;
  payload?: Record<string, unknown>;
  source?: string;
}
