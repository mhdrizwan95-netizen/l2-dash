# Run with TWS/Gateway open. pip install ib-insync requests
import time, math, requests
from ib_insync import IB, Stock
APP_INGEST = 'http://127.0.0.1:3000/api/ingest'
INGEST_KEY = 'CHANGE_ME' # also set env INGEST_KEY in Next app
IB_HOST='127.0.0.1'; IB_PORT=7497; CLIENT_ID=42
SYMBOLS=[('AAPL','SMART','USD'), ('MSFT','SMART','USD')]

def post_tick(symbol, price, ts):
try:
requests.post(APP_INGEST, json={'symbol':symbol,'price':float(price),'ts':int(ts*1000)}, headers={'x-ingest-key':INGEST_KEY}, timeout=1.5)
except Exception as e:
print('POST failed:', e)

def main():
ib=IB(); ib.connect(IB_HOST, IB_PORT, clientId=CLIENT_ID, readonly=True)
contracts={ sym: Stock(sym,ex,c) for sym,ex,c in SYMBOLS }
tickers={}
for sym, ct in contracts.items():
t=ib.reqMktData(ct, snapshot=False)
tickers[sym]=t
last_time=0
def on_update(tk):
nonlocal last_time
sym = next((s for s,t in tickers.items() if t is tk), None)
if not sym: return
p = tk.last if tk.last and not math.isnan(tk.last) else tk.marketPrice()
if p and not math.isnan(p):
now=time.time()
if now-last_time>0.2: # throttle ~5 Hz
last_time=now
post_tick(sym, p, now)
for t in tickers.values():
t.updateEvent += on_update
try:
while True: ib.sleep(0.1)
except KeyboardInterrupt: pass
finally: ib.disconnect()
if __name__=='__main__': main()
