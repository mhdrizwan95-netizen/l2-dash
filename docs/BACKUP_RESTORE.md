# Backup and Restore Guide

This document covers the L2 Dash backup and alert system, including nightly automated backups and manual disaster recovery procedures.

## Overview

The system maintains:
- **Nightly backups** of ML models, trading logs, reports, and configurations
- **Dual storage strategy**: local cache (3 days) + optional remote storage (S3/MinIO, 90 days)
- **Real-time health monitoring** and alerting for service availability and SSE connectivity
- **Alert buffering** when webhooks are unreachable

## Automated Backups

### What Gets Backed Up

- `models/` - Trained ML models and artifacts
- `logs/` - Trading execution logs, fills, and guardrail events
- `reports/` - Daily/weekly performance reports and exports
- `configs/` - Guardrail configurations and system settings

### Schedule

- **Nightly backup**: 02:00 UTC daily
- **Health checks**: Every 5 minutes
- **Log cleanup**: Weekly (Monday 03:00 UTC, removes logs >7 days old)

### Storage Strategy

```
Local (3-day cache in Docker volume):
├── /backups/
│   └── 20251003-020000/
│       ├── models/
│       ├── logs/
│       ├── reports/
│       └── configs/

Remote (optional S3/MinIO):
└── s3://l2trading-staging/snapshots/20251003-020000/
    ├── models/
    ├── logs/
    ├── reports/
    └── configs/
```

### Environment Configuration

Set these in your `.env` file:

```bash
# Remote storage (optional)
BACKUP_BUCKET=s3://your-bucket-name
S3_ENDPOINT=https://minio.yourdomain.com:9000
S3_ACCESS_KEY_ID=your_key
S3_SECRET_ACCESS_KEY=your_secret

# Alert webhooks
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
ALERT_WEBHOOK_SECRET=your_hmac_secret
```

## Manual Operations

### Trigger Backup Manually

```bash
# Run daily backup
docker compose exec cron /app/backup.sh nightly

# Run snapshot backup
docker compose exec cron /app/backup.sh snapshot

# Check backup status
docker compose exec cron /app/backup.sh

# View backup logs
docker compose logs cron
```

### Check Alert System

```bash
# Test alert delivery
docker compose exec cron /app/alert.sh test

# Check buffered alerts count
docker compose exec cron /app/alert.sh buffer-status

# View alert logs
docker compose logs cron | grep ALERT
```

### Check Health Monitor

```bash
# Run health check once
docker compose exec cron /app/health-monitor.sh once

# Show current health status
docker compose exec cron /app/health-monitor.sh status

# Monitor only health endpoints
docker compose exec cron /app/health-monitor.sh health-only

# Monitor only SSE streams
docker compose exec cron /app/health-monitor.sh sse-only
```

## Disaster Recovery

### Scenario 1: Service Failure (auto-recovery expected)

1. Check service logs:
   ```bash
   docker compose logs <service-name> --tail 50
   ```

2. Check health status:
   ```bash
   docker compose exec cron /app/health-monitor.sh health-only
   ```

3. Most services will auto-recover via Docker restart policies.

### Scenario 2: Data Loss (ML Models)

1. **From local backup** (fastest):
   ```bash
   # List available backups
   docker run --rm -v l2-dash_backups:/data alpine ls -la /data/

   # Restore specific backup
   TIMESTAMP="20251003-020000"
   docker run --rm \
     -v l2-dash_backups:/backups \
     -v $(pwd)/ml-service/models:/restore \
     alpine cp -r "/backups/$TIMESTAMP/models/"* /restore/
   ```

2. **From remote storage**:
   ```bash
   # Set S3 credentials in environment
   export AWS_ACCESS_KEY_ID=your_key
   export AWS_SECRET_ACCESS_KEY=your_secret

   # Sync from S3
   aws s3 sync s3://your-bucket/snapshots/20251003-020000/models/ ./ml-service/models/ \
     --endpoint-url https://minio.yourdomain.com:9000 \
     --force-path-style
   ```

3. Restart services:
   ```bash
   docker compose restart ml-service algo
   ```

### Scenario 3: All Systems Down

1. **Quick bootstrap** from local backup:
   ```bash
   # Backup current state (if possible)
   docker compose exec cron /app/backup.sh emergency-pre-restore

   # Restore from most recent backup
   docker compose down
   docker run --rm \
     -v l2-dash_backups:/backups \
     -v $(pwd)/data:/restore \
     alpine sh -c 'LATEST=$(ls -t /backups/ | head -1); cp -r "/backups/$LATEST/"* /restore/'

   # Start with restored data
   docker compose up -d
   ```

2. **Complete rebuild** from remote (if local unavailable):
   ```bash
   # Download latest from S3
   mkdir -p recovery-data
   aws s3 sync s3://your-bucket/snapshots/ ./recovery-data/ \
     --exclude "*" --include "202510*-020000*" \
     --endpoint-url https://minio.yourdomain.com:9000

   # Replace data directory and restart
   rm -rf data/* && cp -r recovery-data/* data/
   docker compose up -d
   ```

### Scenario 4: Corrupt Configuration

1. Restore configs only:
   ```bash
   TIMESTAMP="20251003-020000"
   docker run --rm \
     -v l2-dash_backups:/backups \
     -v $(pwd)/data/configs:/restore \
     alpine cp -r "/backups/$TIMESTAMP/configs/"* /restore/
   ```

2. If env file corrupted, restore from backup:
   ```bash
   cp data/configs/envs/.env.backup .env
   # Edit sensitive values back in
   ```

## Runbook Checklist

### Daily Monitoring
- [ ] Check alerts dashboard (expect 1 info alert per backup)
- [ ] Verify backup volume has recent backups: `docker system df -v | grep backups`
- [ ] Confirm no buffered alerts: `docker compose exec cron /app/alert.sh buffer-status`

### Weekly Maintenance
- [ ] Review backup retention settings vs storage usage
- [ ] Test alert webhook if any failures noted
- [ ] Verify S3/MinIO connectivity: `docker compose exec cron aws s3 ls`

### Monthly Validation
- [ ] Test full restore procedure in staging environment
- [ ] Verify backup integrity (spot check file contents/size)
- [ ] Update backup retention policies if storage costs are high

## Troubleshooting

### High Latency Alerts
- Check service resource usage: `docker stats`
- Scale up containers if CPU/memory constrained
- Consider network latency to health endpoints

### Backup Failures
- Check cron logs: `docker compose logs cron`
- Verify mounted volumes have sufficient space
- Test S3 credentials: `docker compose exec cron aws s3 ls s3://bucket-name/`

### Alert Delivery Issues
- Check webhook URL validity
- Verify network connectivity from cron container
- Review buffered alerts: `docker compose exec cron cat /tmp/alerts_buffer.jsonl`

### Missing Backups
- Confirm cron service is running: `docker compose ps cron`
- Check cron job schedule: `docker compose exec cron crontab -l`
- Verify backup source directories exist and have content

## Security Considerations

- **HMAC signing** enabled for webhooks prevents spoofed alerts
- **Environment isolation** - backup scripts run as non-root user
- **Encryption** handled by S3/MinIO server-side encryption
- **Access control** - backup and alert credentials separate from trading systems

## Performance Impact

- **Backups** run nightly at low-traffic hours
- **Health monitoring** lightweight (sub-second checks every 5 minutes)
- **Storage** budgets: ~100MB/day for logs, ~1GB/month snapshots
- **Network** minimal (health checks only during monitoring cycles)

## Support Contacts

For backup/recovery issues:
- Primary: DevOps rotation
- Secondary: Data team
- Emergency: On-call SRE (for production alerts)

*Last updated: October 2025*
