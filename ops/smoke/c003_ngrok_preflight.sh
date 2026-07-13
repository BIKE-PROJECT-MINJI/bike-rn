#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
RN_DIR="$ROOT_DIR/dev/bike-rn"
EVIDENCE_PATH="${C003_EVIDENCE_PATH:-$ROOT_DIR/.omo/ulw-loop/evidence/G001-C003-rn-expo-road-route-separated-failure-branches.txt}"
BACKEND_BASE_URL="${BACKEND_BASE_URL:-http://127.0.0.1:8080}"
NGROK_API_URL="${NGROK_API_URL:-http://127.0.0.1:4040/api/tunnels}"
NGROK_LOG="$(mktemp -t gaja-c003-ngrok.XXXXXX.log)"
NGROK_PID=""
NGROK_CONFIG_PATH=""
NGROK_TOKEN_SOURCE="missing"
NGROK_RUNTIME_CONFIG_PATH=""

resolve_ngrok_bin() {
  if [[ -n "${NGROK_BIN:-}" ]]; then
    printf '%s\n' "$NGROK_BIN"
  elif [[ -x "$RN_DIR/.local/bin/ngrok" ]]; then
    printf '%s\n' "$RN_DIR/.local/bin/ngrok"
  elif command -v ngrok >/dev/null 2>&1; then
    command -v ngrok
  else
    printf '%s\n' "$RN_DIR/node_modules/.bin/ngrok"
  fi
}

NGROK_BIN="$(resolve_ngrok_bin)"

find_ngrok_config() {
  local candidate
  local candidates=(
    "${NGROK_CONFIG:-}"
    "$HOME/.config/ngrok/ngrok.yml"
    "$HOME/.ngrok2/ngrok.yml"
    "/mnt/c/Users/alswl/AppData/Local/ngrok/ngrok.yml"
  )

  for candidate in "${candidates[@]}"; do
    [[ -n "$candidate" ]] || continue
    if [[ -f "$candidate" ]] && grep -Eq '^[[:space:]]*authtoken:[[:space:]]*\S+' "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

create_ngrok_runtime_config() {
  local token="$1"
  local config_path
  if [[ "$NGROK_BIN" == *.exe ]]; then
    mkdir -p /mnt/c/Users/alswl/AppData/Local/Temp
    config_path="$(mktemp /mnt/c/Users/alswl/AppData/Local/Temp/gaja-c003-ngrok-config.XXXXXX.yml)"
  else
    config_path="$(mktemp -t gaja-c003-ngrok-config.XXXXXX.yml)"
  fi
  chmod 600 "$config_path"
  NGROK_AUTHTOKEN_VALUE="$token" NGROK_CONFIG_OUTPUT="$config_path" python3 - <<'PY'
import os
from pathlib import Path

token = os.environ["NGROK_AUTHTOKEN_VALUE"]
path = Path(os.environ["NGROK_CONFIG_OUTPUT"])
path.write_text(
    'version: "3"\n'
    "agent:\n"
    f"  authtoken: {token}\n",
    encoding="utf-8",
)
PY
  NGROK_RUNTIME_CONFIG_PATH="$config_path"
  if [[ "$NGROK_BIN" == *.exe ]] && command -v wslpath >/dev/null 2>&1; then
    NGROK_CONFIG_PATH="$(wslpath -w "$config_path")"
  else
    NGROK_CONFIG_PATH="$config_path"
  fi
}

write_evidence() {
  local status="$1"
  local reason="$2"
  local public_url="${3:-}"
  local backend_status="${4:-unknown}"
  local cleanup_receipt="${5:-ngrok not started}"
  STATUS="$status" \
  REASON="$reason" \
  PUBLIC_URL="$public_url" \
  BACKEND_STATUS="$backend_status" \
  CLEANUP_RECEIPT="$cleanup_receipt" \
  EVIDENCE_PATH="$EVIDENCE_PATH" \
  NGROK_BIN="$NGROK_BIN" \
  NGROK_LOG="$NGROK_LOG" \
  NGROK_TOKEN_SOURCE="$NGROK_TOKEN_SOURCE" \
  NGROK_CONFIG_PATH="$NGROK_CONFIG_PATH" \
  python3 - <<'PY'
import json
import os
from datetime import datetime, timezone
from pathlib import Path

path = Path(os.environ["EVIDENCE_PATH"])
path.parent.mkdir(parents=True, exist_ok=True)
payload = {
    "status": os.environ["STATUS"],
    "capturedAt": datetime.now(timezone.utc).isoformat(),
    "criterion": "G001-C003",
    "scenario": "RN Expo Go Ngrok route-source preflight",
    "reason": os.environ["REASON"],
    "publicUrl": os.environ["PUBLIC_URL"] or None,
    "backendHealthStatus": os.environ["BACKEND_STATUS"],
    "ngrok": {
        "tokenSource": os.environ["NGROK_TOKEN_SOURCE"],
        "configPath": os.environ["NGROK_CONFIG_PATH"] or None,
        "binary": os.environ["NGROK_BIN"],
        "logPath": os.environ["NGROK_LOG"],
    },
    "rnRouteSourceContract": {
        "preRideCourseRoute": "GET /api/v1/courses/{courseId}/route-points -> 코스 경로 blue polyline",
        "aiRoute": "POST /api/v1/ai-routes/plan -> AI route orange polyline",
        "recordedRide": "foreground location samples -> ride HUD polyline",
    },
    "nextManualEvidence": [
        "Expo Go screenshot or action log showing 코스 경로 blue polyline",
        "Expo Go screenshot or action log showing AI route orange polyline",
        "HTTP body captured through the same Ngrok base URL",
    ],
    "cleanup": os.environ["CLEANUP_RECEIPT"],
}
path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
}

cleanup() {
  if [[ -n "$NGROK_PID" ]] && kill -0 "$NGROK_PID" >/dev/null 2>&1; then
    kill "$NGROK_PID" >/dev/null 2>&1 || true
    wait "$NGROK_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$NGROK_RUNTIME_CONFIG_PATH" && -f "$NGROK_RUNTIME_CONFIG_PATH" ]]; then
    rm -f "$NGROK_RUNTIME_CONFIG_PATH"
  fi
}
trap cleanup EXIT

if [[ -n "${NGROK_AUTHTOKEN:-}" ]]; then
  NGROK_TOKEN_SOURCE="env"
  create_ngrok_runtime_config "$NGROK_AUTHTOKEN"
elif NGROK_CONFIG_PATH="$(find_ngrok_config)"; then
  NGROK_TOKEN_SOURCE="config"
else
  write_evidence "BLOCKED" "NGROK_AUTHTOKEN is not set and no existing ngrok config with authtoken was found." "" "not_checked" "ngrok not started; token source missing"
  echo "BLOCKED: NGROK_AUTHTOKEN is not set and no existing ngrok config was found"
  echo "evidence=$EVIDENCE_PATH"
  exit 2
fi

if [[ ! -x "$NGROK_BIN" ]]; then
  write_evidence "BLOCKED" "ngrok binary is missing or not executable at $NGROK_BIN." "" "not_checked" "ngrok not started; binary missing"
  echo "BLOCKED: ngrok binary is missing at $NGROK_BIN"
  echo "evidence=$EVIDENCE_PATH"
  exit 2
fi

NGROK_VERSION_OUTPUT="$("$NGROK_BIN" version 2>/dev/null || true)"
if [[ ! "$NGROK_VERSION_OUTPUT" =~ ngrok[[:space:]]version[[:space:]]3\. ]]; then
  write_evidence "BLOCKED" "ngrok agent must be v3.20.0 or newer for this account; current output: $NGROK_VERSION_OUTPUT." "" "not_checked" "ngrok not started; binary too old"
  echo "BLOCKED: ngrok agent must be v3.20.0 or newer"
  echo "current=$NGROK_VERSION_OUTPUT"
  echo "evidence=$EVIDENCE_PATH"
  exit 2
fi

if ! curl -fsS "$BACKEND_BASE_URL/health" >/dev/null 2>&1; then
  write_evidence "BLOCKED" "Local backend health check failed before starting Ngrok." "" "failed" "ngrok not started; backend health failed"
  echo "BLOCKED: local backend health failed at $BACKEND_BASE_URL/health"
  echo "evidence=$EVIDENCE_PATH"
  exit 3
fi

"$NGROK_BIN" http 8080 --config "$NGROK_CONFIG_PATH" >"$NGROK_LOG" 2>&1 &
NGROK_PID="$!"

PUBLIC_URL=""
for _ in $(seq 1 30); do
  if ! kill -0 "$NGROK_PID" >/dev/null 2>&1; then
    write_evidence "BLOCKED" "Ngrok process exited before tunnel became available." "" "ok" "ngrok process exited; tokenSource=$NGROK_TOKEN_SOURCE; configPath=${NGROK_CONFIG_PATH:-none}; logPath=$NGROK_LOG"
    echo "BLOCKED: ngrok process exited early"
    echo "evidence=$EVIDENCE_PATH"
    exit 4
  fi
  PUBLIC_URL="$(python3 - <<'PY'
import json
import urllib.error
import urllib.request

try:
    with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=2) as response:
        payload = json.loads(response.read().decode("utf-8"))
except (OSError, urllib.error.URLError, json.JSONDecodeError):
    print("")
else:
    for tunnel in payload.get("tunnels", []):
        public_url = tunnel.get("public_url", "")
        if public_url.startswith("https://"):
            print(public_url)
            break
PY
)"
  if [[ -n "$PUBLIC_URL" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$PUBLIC_URL" ]]; then
  write_evidence "BLOCKED" "Ngrok public URL was not available within timeout." "" "ok" "ngrok killed after timeout; tokenSource=$NGROK_TOKEN_SOURCE; configPath=${NGROK_CONFIG_PATH:-none}; logPath=$NGROK_LOG"
  echo "BLOCKED: ngrok public URL timeout"
  echo "evidence=$EVIDENCE_PATH"
  exit 4
fi

if ! curl -fsS "$PUBLIC_URL/health" >/dev/null 2>&1; then
  write_evidence "BLOCKED" "Ngrok public URL is up but /health did not return success." "$PUBLIC_URL" "public_failed" "ngrok killed after public health failure; tokenSource=$NGROK_TOKEN_SOURCE; configPath=${NGROK_CONFIG_PATH:-none}; logPath=$NGROK_LOG"
  echo "BLOCKED: public health failed at $PUBLIC_URL/health"
  echo "evidence=$EVIDENCE_PATH"
  exit 5
fi

curl -fsS "$PUBLIC_URL/api/v1/courses?limit=2" >/dev/null
write_evidence "READY_FOR_EXPO_GO_SCREENSHOT" "Ngrok public backend URL is ready; run Expo Go with EXPO_PUBLIC_API_BASE_URL and capture route-source screenshots." "$PUBLIC_URL" "public_ok" "ngrok killed by trap after preflight; tokenSource=$NGROK_TOKEN_SOURCE; configPath=${NGROK_CONFIG_PATH:-none}; logPath=$NGROK_LOG"
echo "READY_FOR_EXPO_GO_SCREENSHOT"
echo "publicUrl=$PUBLIC_URL"
echo "evidence=$EVIDENCE_PATH"
