#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
LOG_DIR="$ROOT/sessions/logs"
mkdir -p "$LOG_DIR"
VENV_PATH="$ROOT/.venv_l2"
DEPS_MARKER="$VENV_PATH/.deps_installed"
PYTHON_BIN="${PYTHON_BIN:-python3.11}"

cleanup() {
  local code=$?
for pid in "${ML_PID:-}" "${BRIDGE_PID:-}" "${BACK_PID:-}" "${FRONT_PID:-}"; do
    if [[ -n "$pid" ]]; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
  wait >/dev/null 2>&1 || true
  exit $code
}
trap cleanup EXIT INT TERM

cd "$ROOT"

if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "[run_stack] Required interpreter '$PYTHON_BIN' not found."
  echo "[run_stack] Install it (e.g. 'brew install python@3.11') or set PYTHON_BIN to an alternate 3.11 interpreter."
  exit 1
fi

if [[ -x "$VENV_PATH/bin/python" ]]; then
  VENV_VERSION="$($VENV_PATH/bin/python -c 'import sys; print("{}.{}".format(*sys.version_info[:2]))')"
else
  VENV_VERSION=""
fi

if [[ "$VENV_VERSION" != "3.11" ]]; then
  if [[ -d "$VENV_PATH" ]]; then
    echo "[run_stack] Re-creating virtualenv with Python 3.11"
    rm -rf "$VENV_PATH"
  else
    echo "[run_stack] Creating Python virtual environment at $VENV_PATH"
  fi
  "$PYTHON_BIN" -m venv "$VENV_PATH"
fi

source "$VENV_PATH/bin/activate"

if [[ ! -f "$DEPS_MARKER" || "$DEPS_MARKER" -ot "$ROOT/services/requirements.txt" ]]; then
  echo "[run_stack] Installing Python service dependencies"
  pip install --upgrade pip
  pip install -r "$ROOT/services/requirements.txt"
  touch "$DEPS_MARKER"
fi

if [[ ! -d "$ROOT/node_modules" ]]; then
  echo "[run_stack] Installing frontend dependencies"
  npm install
fi

python3 -m services.run_local \
  >"$LOG_DIR/backend.log" 2>&1 &
BACK_PID=$!

npm run dev \
  >"$LOG_DIR/frontend.log" 2>&1 &
FRONT_PID=$!

python3 ib_bridge.py \
  >"$LOG_DIR/ib_bridge.log" 2>&1 &
BRIDGE_PID=$!

uvicorn ml-service.main:app --host 127.0.0.1 --port 8000 \
  >"$LOG_DIR/ml_service.log" 2>&1 &
ML_PID=$!

echo "Backend PID: $BACK_PID (logs at sessions/logs/backend.log)"
echo "Frontend PID: $FRONT_PID (logs at sessions/logs/frontend.log)"
echo "IBKR Bridge PID: $BRIDGE_PID (logs at sessions/logs/ib_bridge.log)"
echo "ML Service PID: $ML_PID (logs at sessions/logs/ml_service.log)"

echo "Press Ctrl+C to stop all processes."
wait
