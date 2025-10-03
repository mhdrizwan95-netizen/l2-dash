
import numpy as np
import pandas as pd

def spread_bp(bid: float, ask: float) -> float:
    """
    Calculates the spread in basis points.
    """
    mid_price = (ask + bid) / 2
    if mid_price == 0:
        return 0
    return ((ask - bid) / mid_price) * 10000

def book_imbalance(bid_size: float, ask_size: float) -> float:
    """
    Calculates the order book imbalance.
    """
    total_size = bid_size + ask_size
    if total_size == 0:
        return 0
    return (bid_size - ask_size) / total_size

def order_flow_imbalance(trades: list[dict]) -> float:
    """
    Calculates the order flow imbalance from a list of trades.
    Each trade is a dict with 'side' ('BUY' or 'SELL') and 'size'.
    """
    ofi = 0
    for trade in trades:
        if trade['side'] == 'BUY':
            ofi += trade['size']
        else:
            ofi -= trade['size']
    return ofi

def microprice(bid_price: float, ask_price: float, bid_size: float, ask_size: float) -> float:
    """
    Calculates the microprice (weighted mid-price).
    """
    total_size = bid_size + ask_size
    if total_size == 0:
        return (bid_price + ask_price) / 2
    return (bid_price * ask_size + ask_price * bid_size) / total_size

def rolling_volatility(series: pd.Series, window: int = 20) -> pd.Series:
    """
    Calculates the rolling volatility.
    """
    return series.rolling(window=window).std()

