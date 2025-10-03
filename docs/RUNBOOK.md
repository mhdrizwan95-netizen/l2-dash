# L2 DASH Runbook

## Overview
L2 DASH is a high-frequency trading system combining HMM models with live IBKR execution. This runbook provides operational procedures for start/stop/recovery/position management.

## Prerequisites
- Docker Compose environment configured
- IBKR paper/live account credentials
- Access to NJ VPS (staging) and production environment

## Normal Operations

### Start System
```bash
# On server
cd /opt/l2-dash
docker compose pull && docker compose up -d

# Verify all services
docker compose ps
# Should show all services: Up (healthy)

# In browser, visit cockpit and analytics dashboards
```

### Stop System
```bash
# Graceful shutdown
docker compose down

# Emergency kill (if unresponsive)
docker compose kill && docker compose down -v
```

### Monitor Health
- Visit `/cockpit` - Check guardrail badges (SPREAD, POS, COOL, LAT, DD, KILL, CONF, DRIFT)
- Visit `/analytics` - Review latency, connectivity, model health cards
- Check logs: `docker compose logs -f --tail=100`

## Breaker Flows

### Circuit Breaker Triggers
System automatically triggers breakers for:
- **POSITION**: >20% of max_position
- **COOLING**: Trade frequency >50 TPS sustained
- **LATENCY**: IBKR API >500ms or SSE >3s reconnect
- **DD**: Daily drawdown >$5000 or -5%
- **CONF**: Model confidence <0.7 across 5+ symbols
- **DRIFT**: Price drift >2% from fair value

### Recovery from Breaker
1. **Immediate**: KILL switch activated, flattens all positions
2. **Check**: Verify flatten executed cleanly in blotter
3. **Cool**: Wait 5 minutes, monitor guardrail clearance
4. **Restart**: If no persistent issues:
   ```bash
   docker compose restart algo ml-service
   ```

### Emergency Flatten
Hotkey: `Ctrl/Cmd+F` in cockpit
```bash
# Or via API
curl -X POST http://localhost:3000/api/exec/flatten-all \
  -H "Authorization: Bearer $TRADING_TOKEN"
```

## Recovery Scenarios

### Service Down (Algo/ML)
```bash
docker compose restart algo ml-service
# Check /health/all endpoint
curl http://localhost:8080/health/all
```

### Broker Disconnection
- System auto-reconnects IBKR feed
- If >60s downtime: Alert triggers, positions flatten
- Manual reconnect: `Ctrl+R` in cockpit or docker compose restart broker-bridge

### DJI Alert (>5% move in 5min)
- Automatic DD breaker trigger
- Positions flatten within 100ms
- Review next business day for resumption

### Model Retrain Needed
```bash
# Stop trading
docker compose stop algo

# Trigger model rebuild
docker compose run --rm ml-service python main.py --retrain

# Verify performance in analytics dashboard
# Resume trading
docker compose start algo
```

## Position Management

### View Current Positions
- Cockpit: OrdersFillsPositions pane
- Analytics: Positions card shows exposure by symbol

### Manual Position Adjustments
```bash
# Via cockpit order ticket
# Or direct API for emergency overrides
curl -X POST http://localhost:3000/api/exec/order \
  -d '{"symbol":"AAPL","qty":1,"side":"BUY","type":"LMT","limit":150.00}'
```

## Backup and Restore

### Nightly Backup
Automated cron runs at 02:00 UTC:
- Models stored in `/backups/hmm/`
- Logs backed up to `/backups/logs/`
- Trades journaled to `/backups/fills/`

### Restore from Backup
```bash
# Stop system
docker compose down

# Copy latest backup
cp /backups/hmm/YYYY-MM-DD/models /opt/l2-dash/data/models/

# Restart services
docker compose up -d
```

## Contact and Escalation

- **P1 Issues**: IMMEDIATE - Call on-call engineer
- **P2 Issues**: <4hr - Email ops@tradingsystem.com
- **Routine**: GitHub Issues or Slack #ops
