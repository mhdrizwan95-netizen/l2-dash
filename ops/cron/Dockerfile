FROM alpine:3.18

# Install dependencies: cron, bash, curl, awscli, rsync, jq
RUN apk add --no-cache \
    dcron \
    bash \
    curl \
    aws-cli \
    rsync \
    jq \
    grep \
    findutils \
    && rm -rf /var/cache/apk/*

# Create app user and directories
RUN addgroup -S cronuser && adduser -S cronuser -G cronuser \
    && mkdir -p /app /data /backups \
    && chown -R cronuser:cronuser /app /data /backups

# Copy scripts
COPY --chown=cronuser:cronuser backup.sh /app/
COPY --chown=cronuser:cronuser alert.sh /app/
COPY --chown=cronuser:cronuser health-monitor.sh /app/

# Make scripts executable
RUN chmod +x /app/*.sh

# Setup cron
COPY --chown=cronuser:cronuser crontab /etc/crontabs/cronuser

USER cronuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD echo "cron service running"

# Start cron in foreground
ENTRYPOINT ["crond", "-f", "-l", "2"]
