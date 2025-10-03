export interface Fill {
  timestamp: string;
  orderId: string;
  strategyId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number;
  fee: number;
}
