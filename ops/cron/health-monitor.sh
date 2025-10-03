#!/usr/bin/env bash
set -euo pipefail

# L2 Dash Health Monitor
# Monitors service health and SSE connectivity with alerts

# Import alert functions
source /app/alert.sh

# Monitor thresholds (environment configurable)
SSE_UI_STALE_SEC="${SSE_UI_STALE_SEC:-60}"
SSE_SERVICE_STALE_SEC="${SSE_SERVICE_STALE_SEC:-15}"
HEALTH_FAIL_THRESHOLD="${HEALTH_FAIL_THRESHOLD:-3}"
LAT_P95_LIMIT_MS="${LAT_P95_LIMIT_MS:-200}"
LAT_BREACH_WINDOWS="${LAT_BREACH_WINDOWS:-2}"

# Service endpoints
SERVICES=(
    "dashboard:http:3000"
    "ml-service:http:8000"
    "algo:http:8001"
    "broker-bridge:http:8002"
    "blotter:http:8003"
)

# State tracking files
SSE_STATE_FILE="${SSE_STATE_FILE:-/tmp/sse_state.json}"
HEALTH_STATE_FILE="${HEALTH_STATE_FILE:-/tmp/health_state.json}"

# Initialize state files if they don't exist
touch "$SSE_STATE_FILE" "$HEALTH_STATE_FILE"

log() {
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] HEALTH-MONITOR: $*" >&2
}

parse_service_endpoint() {
    local service_spec="$1"
    IFS=':' read -r name proto port <<< "$service_spec"
    echo "$name" "$proto" "$port"
}

test_health_endpoint() {
    local name="$1"
    local proto="$2"
    local port="$3"

    local url="$proto://localhost:$port/health"
    local start_time=$(date +%s%3N)  # milliseconds

    if curl -s -f --max-time 5 --connect-timeout 2 "$url" >/dev/null 2>&1; then
        local end_time=$(date +%s%3N)
        local latency=$((end_time - start_time))
        echo "success:$latency"
    else
        echo "failure:$?"
    fi
}

update_health_state() {
    local name="$1"
    local result="$2"

    local current_state=$(jq ".\"$name\"" "$HEALTH_STATE_FILE" 2>/dev/null || echo "{}")

    # Parse result
    IFS=':' read -r status value <<< "$result"

    if [[ "$status" == "success" ]]; then
        # Success - reset failure count
        local latency="$value"
        local new_state=$(jq -n \
            --arg name "$name" \
            --argjson consecutive_fails 0 \
            --arg last_success "$(date -u +%Y-%m-%dT%H:%M:%S)" \
            --argjson latency "$latency" \
            --arg status "healthy" \
            "{\"\($name)\": {consecutive_fails: .consecutive_fails, last_success: .last_success, latency: .latency, status: .status}}"
        )
    else
        # Failure - increment consecutive fails
        local consecutive_fails=$(jq ".\"$name\".consecutive_fails // 0" <<< "$current_state")
        ((consecutive_fails++))
        local new_state=$(jq -n \
            --arg name "$name" \
            --argjson consecutive_fails "$consecutive_fails" \
            --arg last_failure "$(date -u +%Y-%m-%dT%H:%M:%S)" \
            --arg status "unhealthy" \
            "{\"\($name)\": {consecutive_fails: .consecutive_fails, last_failure: .last_failure, status: .status}}"
        )
    fi

    # Update state file
    local updated_state=$(jq ". * $new_state" "$HEALTH_STATE_FILE")
    echo "$updated_state" > "$HEALTH_STATE_FILE.tmp"
    mv "$HEALTH_STATE_FILE.tmp" "$HEALTH_STATE_FILE"

    echo "$status:$value:$consecutive_fails"
}

check_health() {
    log "Checking service health..."

    local alerts_sent=0

    for service_spec in "${SERVICES[@]}"; do
        read -r name proto port <<< "$(parse_service_endpoint "$service_spec")"

        log "Testing $name health endpoint"
        local result=$(test_health_endpoint "$name" "$proto" "$port")

        # Update state and get processed result
        read -r status value consecutive_fails <<< "$(update_health_state "$name" "$result")"

        if [[ "$status" == "success" ]]; then
            local latency="$value"
            log "$name: healthy (${latency}ms)"

            # Check for previous consecutive failures and recovery
            if [[ "$consecutive_fails" -eq 0 ]]; then
                local prev_fails=$(jq ".\"$name\".consecutive_fails // 0" <<< "$(cat "$HEALTH_STATE_FILE.tmp" 2>/dev/null || echo '{}')")
                if [[ "$prev_fails" -gt 0 && "$prev_fails" -ge $HEALTH_FAIL_THRESHOLD ]]; then
                    send_alert "info" "SERVICE_RECOVERY" "$name service recovered" "$name"
                    ((alerts_sent++))
                fi
            fi

            # Check latency threshold
            if [[ "$latency" -gt $LAT_P95_LIMIT_MS ]]; then
                local breach_count=$(jq ".\"$name\".latency_breaches // 0" <<< "$(cat "$HEALTH_STATE_FILE")" )
                ((breach_count++))
                if [[ "$breach_count" -ge $LAT_BREACH_WINDOWS ]]; then
                    send_alert "warning" "HIGH_LATENCY" "$name latency ${latency}ms exceeds ${LAT_P95_LIMIT_MS}ms" "$name" "latency_ms:$latency"
                    ((alerts_sent++))
                    breach_count=0  # Reset after alert
                fi
                # Update breach count
                local updated_breach_state=$(jq ".\"$name\".latency_breaches |= $breach_count" "$HEALTH_STATE_FILE")
                echo "$updated_breach_state" > "$HEALTH_STATE_FILE"
            fi
        else
            log "$name: unhealthy (consecutive failures: $consecutive_fails)"

            if [[ "$consecutive_fails" -ge $HEALTH_FAIL_THRESHOLD ]]; then
                send_alert "critical" "SERVICE_UNHEALTHY" "$name health check failed $consecutive_fails times" "$name"
                ((alerts_sent++))
            fi
        fi
    done

    log "Health check complete, $alerts_sent alerts sent"
}

# SSE staleness monitoring (simple timestamp checks)
update_sse_state() {
    local stream_name="$1"
    local last_timestamp="${2:-}"

    if [[ -z "$last_timestamp" ]]; then
        # No timestamp provided, check file
        last_timestamp=$(jq ".\"$stream_name\".last_seen // \"$(date -u +%s)\"" "$SSE_STATE_FILE" 2>/dev/null || echo "$(date -u +%s)")
    fi

    local now=$(date -u +%s)
    local age=$((now - last_timestamp))

    # Update state
    local current_state=$(jq ".\"$stream_name\" = {last_seen: $last_timestamp, age: $age, updated: \"$(date -u +%Y-%m-%dT%H:%M:%S)\"}" "$SSE_STATE_FILE")
    echo "$current_state" > "$SSE_STATE_FILE"

    echo "$age"
}

check_sse_staleness() {
    log "Checking SSE staleness..."

    local alerts_sent=0

    # UI SSE streams (more tolerant)
    local ui_streams=("heartbeat" "exec/fills" "hmm/state" "health/all")
    for stream in "${ui_streams[@]}"; do
        # In a real implementation, we'd need to check actual SSE timestamps
        # For now, assume we have some way to get last event time
        local age=$(update_sse_state "$stream")

        if [[ "$age" -gt $SSE_UI_STALE_SEC ]]; then
            send_alert "warning" "SSE_STALE" "UI SSE stream $stream stale for ${age}s" "dashboard" "stream:$stream;age_sec:$age"
            ((alerts_sent++))
        fi
    done

    # Internal service SSE streams (stricter)
    local internal_streams=("broker/status" "exec/guardrails" "ml/latency" "exec/latency")
    for stream in "${internal_streams[@]}"; do
        local age=$(update_sse_state "$stream")

        if [[ "$age" -gt $SSE_SERVICE_STALE_SEC ]]; then
            send_alert "critical" "SSE_STALE" "Internal SSE stream $stream stale for ${age}s" "$stream" "stream:$stream;age_sec:$age"
            ((alerts_sent++))
        fi
    done

    log "SSE staleness check complete, $alerts_sent alerts sent"
}

cleanup_old_states() {
    # Clean up state files older than 24 hours to prevent bloat
    find /tmp -maxdepth 1 -name "*state.json*" -mtime +1 -delete 2>/dev/null || true
}

main() {
    log "Starting health monitoring cycle"

    check_health
    check_sse_staleness
    cleanup_old_states

    log "Health monitoring cycle complete"
}

# Allow running as standalone script
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        once)
            main
            ;;
        health-only)
            check_health
            ;;
        sse-only)
            check_sse_staleness
            ;;
        status)
            echo "=== Health State ==="
            cat "$HEALTH_STATE_FILE" | jq . 2>/dev/null || echo "No health state"
            echo
            echo "=== SSE State ==="
            cat "$SSE_STATE_FILE" | jq . 2>/dev/null || echo "No SSE state"
            ;;
        *)
            echo "Usage: $0 {once|health-only|sse-only|status}" >&2
            exit 1
            ;;
    esac
fi
