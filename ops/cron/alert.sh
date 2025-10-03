#!/usr/bin/env bash

# L2 Dash Alert Utility
# Sends webhook notifications with optional HMAC signing and disk buffering

# Configuration from environment
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
ALERT_WEBHOOK_FALLBACK="${ALERT_WEBHOOK_FALLBACK:-}"
ALERT_WEBHOOK_SECRET="${ALERT_WEBHOOK_SECRET:-}"
ALERT_ENV="${ALERT_ENV:-prod}"

# Buffering
ALERT_BUFFER_FILE="${ALERT_BUFFER_FILE:-/tmp/alerts_buffer.jsonl}"
MAX_BUFFER_SIZE="${MAX_BUFFER_SIZE:-1000}"

# Logging
ALERT_LOG_FILE="${ALERT_LOG_FILE:-/tmp/alerts.log}"

log() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >&2
    if [[ -n "${ALERT_LOG_FILE:-}" ]]; then
        echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$ALERT_LOG_FILE"
    fi
}

send_webhook() {
    local url="$1"
    local body="$2"
    local headers="$3"

    log "Sending alert to $url"

    # Use curl with timeout and retries
    if curl -s -f --max-time 10 --retry 2 --retry-connrefused \
           -X POST \
           -H "Content-Type: application/json" \
           $headers \
           -d "$body" \
           "$url" >/dev/null; then
        log "Alert sent successfully to $url"
        return 0
    else
        log "Failed to send alert to $url (exit code: $?)"
        return 1
    fi
}

buffer_alert() {
    local body="$1"

    # Create buffer file if it doesn't exist
    touch "$ALERT_BUFFER_FILE"

    # Append to buffer
    echo "$body" >> "$ALERT_BUFFER_FILE"

    log "Alert buffered to disk: $(jq -r '.message // .event' <<< "$body")"

    # Truncate buffer if too large (keep last MAX_BUFFER_SIZE lines)
    local lines=$(wc -l < "$ALERT_BUFFER_FILE" 2>/dev/null || echo 0)
    if [[ $lines -gt $MAX_BUFFER_SIZE ]]; then
        tail -n "$MAX_BUFFER_SIZE" "$ALERT_BUFFER_FILE" > "${ALERT_BUFFER_FILE}.tmp"
        mv "${ALERT_BUFFER_FILE}.tmp" "$ALERT_BUFFER_FILE"
        log "Truncated alert buffer to $MAX_BUFFER_SIZE entries"
    fi

    # Warn about buffered alerts
    if [[ $lines -gt 100 ]]; then
        log "WARNING: $lines alerts buffered on disk - webhook may be unreachable"
    fi
}

process_buffer() {
    if [[ ! -f "$ALERT_BUFFER_FILE" ]]; then
        return 0
    fi

    local sent=0
    local failed=0

    while read -r body; do
        if [[ -z "$body" ]]; then
            continue
        fi

        if send_to_webhooks "$body"; then
            ((sent++))
        else
            failed=1
        fi
    done < "$ALERT_BUFFER_FILE"

    if [[ $sent -gt 0 ]]; then
        log "Processed $sent buffered alerts"

        # Remove processed alerts from buffer
        if [[ $failed -eq 0 ]]; then
            # All sent successfully, empty buffer
            > "$ALERT_BUFFER_FILE"
        else
            # Keep failed ones in buffer
            log "Keeping failed alerts in buffer"
        fi
    fi
}

send_to_webhooks() {
    local body="$1"

    # Try primary webhook first
    local sent=0

    if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
        local headers=""
        if [[ -n "$ALERT_WEBHOOK_SECRET" ]]; then
            local sig=$(echo -n "$body" | openssl dgst -sha256 -hmac "$ALERT_WEBHOOK_SECRET" -binary | xxd -p -c 256)
            headers="-H X-Hub-Signature-256: sha256=$sig"
        fi

        if send_webhook "$ALERT_WEBHOOK_URL" "$body" "$headers"; then
            sent=1
        fi
    fi

    # Try fallback webhook if primary failed
    if [[ $sent -eq 0 && -n "$ALERT_WEBHOOK_FALLBACK" ]]; then
        log "Primary webhook failed, trying fallback"
        local headers=""
        if [[ -n "$ALERT_WEBHOOK_SECRET" ]]; then
            local sig=$(echo -n "$body" | openssl dgst -sha256 -hmac "$ALERT_WEBHOOK_SECRET" -binary | xxd -p -c 256)
            headers="-H X-Hub-Signature-256: sha256=$sig"
        fi

        if send_webhook "$ALERT_WEBHOOK_FALLBACK" "$body" "$headers"; then
            sent=1
        fi
    fi

    # Buffer if all webhooks failed
    if [[ $sent -eq 0 ]]; then
        buffer_alert "$body"
        return 1
    fi

    # Try sending buffered alerts if we succeeded
    process_buffer
    return 0
}

send_alert() {
    local severity="$1"
    local event="$2"
    local message="$3"
    local service="${4:-cron}"
    local labels="${5:-}"

    # Create alert payload using jq or manual JSON construction
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S)
    local json_labels=""
    if [[ -n "$labels" ]]; then
        # Convert semicolon-delimited labels to JSON array
        IFS=';' read -ra label_array <<< "$labels"
        local label_json=""
        for label in "${label_array[@]}"; do
            [[ -n "$label_json" ]] && label_json+=","
            label_json+="\"$label\""
        done
        json_labels=",\"labels\":[$label_json]"
    fi

    local payload="{\"env\":\"$ALERT_ENV\",\"service\":\"$service\",\"severity\":\"$severity\",\"event\":\"$event\",\"message\":\"$message\",\"at\":\"$timestamp\"$json_labels}"

    local body="$payload"

    log "Sending alert: $event ($severity) - $message"

    if ! send_to_webhooks "$body"; then
        log "Alert delivery failed for: $event"
        return 1
    fi

    return 0
}

# Function aliases for backward compatibility
alert_warning() { send_alert "warning" "$@"; }
alert_critical() { send_alert "critical" "$@"; }
alert_info() { send_alert "info" "$@"; }

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        test)
            log "Testing alert system..."
            send_alert "info" "ALERT_TEST" "Test alert from cron service" "cron"
            ;;
        buffer-status)
            if [[ -f "$ALERT_BUFFER_FILE" ]]; then
                wc -l < "$ALERT_BUFFER_FILE" 2>/dev/null || echo "0"
            else
                echo "0"
            fi
            ;;
        *)
            echo "Usage: $0 {test|buffer-status}" >&2
            exit 1
            ;;
    esac
fi
