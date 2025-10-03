#!/usr/bin/env bash
set -euo pipefail

# L2 Dash Backup Script
# Performs nightly backups of models, logs, and reports
# Supports local caching and optional S3/MinIO remote storage

# Source paths (mounted volumes)
SRC_MODELS="${BACKUP_SRC_MODELS:-/data/models}"
SRC_LOGS="${BACKUP_SRC_LOGS:-/data/logs}"
SRC_REPORTS="${BACKUP_SRC_REPORTS:-/data/reports}"
SRC_CONFIGS="${BACKUP_SRC_CONFIGS:-/data/configs}"

# Local cache directory
LOCAL_DIR="${BACKUP_LOCAL_DIR:-/backups}"

# Remote storage
BACKUP_BUCKET="${BACKUP_BUCKET:-}"
BACKUP_PREFIX="${BACKUP_PREFIX:-snapshots}"
S3_ENDPOINT="${S3_ENDPOINT:-}"
S3_REGION="${S3_REGION:-us-east-1}"

# Retention settings
BACKUP_RETENTION_LOCAL_DAYS="${BACKUP_RETENTION_LOCAL_DAYS:-3}"
BACKUP_RETENTION_REMOTE_DAYS="${BACKUP_RETENTION_REMOTE_DAYS:-90}"

# Backup hour (for naming)
BACKUP_DAILY_HOUR="${BACKUP_DAILY_HOUR:-02}"

# Timestamp for this backup run
TS=$(date -u +%Y%m%d-%H%M%S)
BACKUP_NAME="${TS}"

# Alert function (source from alert.sh)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/alert.sh"

BACKUP_TYPE="${1:-nightly}"
export ALERT_ENV BACKUP_BUCKET BACKUP_PREFIX TS BACKUP_TYPE

log() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >&2
}

alert_warning() {
    send_alert "warning" "BACKUP_${BACKUP_TYPE^^}" "$1" "${2:-}" "" || log "Failed to send alert: $1"
}

alert_critical() {
    send_alert "critical" "BACKUP_${BACKUP_TYPE^^}" "$1" "${2:-}" "" || log "Failed to send alert: $1"
}

backup_dir() {
    local src="$1"
    local name="$2"

    if [[ ! -d "$src" ]]; then
        log "Source directory $src does not exist, skipping $name"
        return 0
    fi

    log "Backing up $name from $src"

    # Create backup subdirectory
    mkdir -p "$LOCAL_DIR/$BACKUP_NAME/$name"

    # Use rsync to copy with preservation
    if rsync -a "$src/" "$LOCAL_DIR/$BACKUP_NAME/$name/" 2>/dev/null; then
        log "Successfully backed up $name"
    else
        log "Warning: rsync failed for $name"
        return 1
    fi
}

sync_to_remote() {
    if [[ -z "${BACKUP_BUCKET:-}" ]]; then
        log "No BACKUP_BUCKET configured, skipping remote sync"
        return 0
    fi

    local remote_path="$BACKUP_BUCKET/$BACKUP_PREFIX/$BACKUP_NAME"

    log "Syncing to remote: $remote_path"

    local aws_cmd=(
        aws s3 sync "$LOCAL_DIR/$BACKUP_NAME" "$remote_path"
        --region "$S3_REGION"
    )

    if [[ -n "$S3_ENDPOINT" ]]; then
        aws_cmd+=(--endpoint-url "$S3_ENDPOINT")
    fi

    # Add force path style for MinIO compatibility
    if [[ "${S3_FORCE_PATH_STYLE:-false}" == "true" ]]; then
        aws_cmd+=(--force-path-style)
    fi

    if "${aws_cmd[@]}"; then
        log "Successfully synced to remote storage"
    else
        alert_warning "Remote backup failed, keeping local copy" "Sync to $remote_path failed with exit code $?"
        return 1
    fi
}

prune_local() {
    log "Pruning local backups older than $BACKUP_RETENTION_LOCAL_DAYS days"

    # Find and remove old directories
    find "$LOCAL_DIR" -maxdepth 1 -type d -mtime +"$BACKUP_RETENTION_LOCAL_DAYS" -exec rm -rf {} \; 2>/dev/null || true

    local remaining=$(find "$LOCAL_DIR" -maxdepth 1 -type d | wc -l)
    log "Local pruning complete, $remaining backup sets remaining"
}

prune_remote() {
    if [[ -z "${BACKUP_BUCKET:-}" ]]; then
        return 0
    fi

    log "Pruning remote backups older than $BACKUP_RETENTION_REMOTE_DAYS days"

    local aws_cmd=(
        aws s3api list-objects-v2
        --bucket "$(basename "$BACKUP_BUCKET")"
        --prefix "$BACKUP_PREFIX/"
        --query 'Contents[?LastModified<=`'"$(date -d "$BACKUP_RETENTION_REMOTE_DAYS days ago" +%Y-%m-%dT%H:%M:%SZ)"'`].Key'
        --output text
        --region "$S3_REGION"
    )

    if [[ -n "$S3_ENDPOINT" ]]; then
        aws_cmd+=(--endpoint-url "$S3_ENDPOINT")
    fi

    if [[ "${S3_FORCE_PATH_STYLE:-false}" == "true" ]]; then
        aws_cmd+=(--force-path-style)
    fi

    # Get list of old objects
    local old_objects
    old_objects=$("${aws_cmd[@]}") || {
        log "Warning: Failed to list remote objects for pruning"
        return 1
    }

    if [[ -n "$old_objects" ]]; then
        # Delete old objects
        echo "$old_objects" | while read -r key; do
            aws s3api delete-object --bucket "$(basename "$BACKUP_BUCKET")" --key "$key" --region "$S3_REGION" \
                ${S3_ENDPOINT:+--endpoint-url $S3_ENDPOINT} \
                ${S3_FORCE_PATH_STYLE:+--force-path-style} || true
        done
        log "Remote pruning complete"
    else
        log "No remote objects to prune"
    fi
}

main() {
    log "Starting $BACKUP_TYPE backup: $BACKUP_NAME"

    # Ensure backup directory exists
    mkdir -p "$LOCAL_DIR"

    # Perform backups
    local failed=0

    backup_dir "$SRC_MODELS" "models" || ((failed++)) || true
    backup_dir "$SRC_LOGS" "logs" || ((failed++)) || true
    backup_dir "$SRC_REPORTS" "reports" || ((failed++)) || true
    backup_dir "$SRC_CONFIGS" "configs" || ((failed++)) || true

    if [[ $failed -gt 0 ]]; then
        alert_warning "Backup partially failed" "$failed directories failed to backup"
    fi

    # Sync to remote storage
    sync_to_remote || log "Remote sync failed"

    # Prune old backups
    prune_local
    prune_remote

    local size=$(du -sh "$LOCAL_DIR/$BACKUP_NAME" 2>/dev/null | cut -f1 || echo "unknown")
    log "$BACKUP_TYPE backup complete: $BACKUP_NAME (${size})"

    # Success alert
    send_alert "info" "BACKUP_${BACKUP_TYPE^^}" "$BACKUP_TYPE backup completed successfully" "" "backup_name:$BACKUP_NAME,size:$size"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
