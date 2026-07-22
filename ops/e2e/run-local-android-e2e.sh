#!/usr/bin/env bash
# Local Android E2E gate. It is intentionally non-green while known UI gaps remain.
set -u -o pipefail

readonly TEST_ID="${E2E_TEST_ID:-T-RN-E2E-01}"
readonly SERIAL="${ANDROID_SERIAL:-emulator-5554}"
readonly APP_ID="${E2E_APP_ID:-com.bikeprojectminji.gaja}"
readonly EXPECTED_MAESTRO_VERSION="2.7.0"
readonly API_INPUT="${E2E_API_BASE_URL:-http://127.0.0.1:8080}"
readonly RUN_ID="${E2E_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
readonly RUN_DIR="${E2E_ARTIFACT_ROOT:-ops/e2e/artifacts}/${TEST_ID}/${RUN_ID}"
readonly FINAL_MANIFEST="${RUN_DIR}/final-status.json"
readonly ACCOUNT_FILE="${E2E_ACCOUNT_FILE:-/tmp/t-rn-e2e-accounts.json}"
readonly METRO_PORT="${E2E_METRO_PORT:-8081}"

native=UNRUN; login=UNRUN; ai=UNRUN; ride_offline=UNRUN; party=UNRUN; api_matrix=UNRUN; metro_pid=""

redact() { sed -E 's/(Bearer )[[:alnum:]._-]+/\1[REDACTED]/g; s/(token|access_token|refresh_token|password)=[^[:space:]&]+/\1=[REDACTED]/gi; s/[0-9]{5,}/[REDACTED_NUMBER]/g; s/-?[0-9]{1,3}\.[0-9]{4,}/[REDACTED_COORD]/g'; }
write_manifest() {
  mkdir -p "$RUN_DIR"
  local temp="${FINAL_MANIFEST}.tmp-$$"
  printf '{\n  "testId": "%s",\n  "runId": "%s",\n  "commit": "%s",\n  "outcome": "FAIL",\n  "scenarios": {"native":"%s","login":"%s","ai":"%s","rideOffline":"%s","party":"%s","apiMatrix":"%s"}\n}\n' \
    "$TEST_ID" "$RUN_ID" "$(git rev-parse HEAD)" "$native" "$login" "$ai" "$ride_offline" "$party" "$api_matrix" > "$temp"
  mv -f "$temp" "$FINAL_MANIFEST"
}
cleanup() {
  local code=$?
  # Expo's npm launcher owns a separate process group; stop the whole local group.
  [ -n "$metro_pid" ] && kill -- "-$metro_pid" 2>/dev/null || true
  # Raw Maestro/Metro output can contain input codepoints; it is never retained.
  rm -rf "${RUN_DIR}/raw"
  case "$ACCOUNT_FILE" in /tmp/*) rm -f -- "$ACCOUNT_FILE" ;; esac
  rm -f /tmp/t-rn-e2e-*.log /tmp/t-rn-e2e-*.json
  write_manifest
  exit "$code"
}
trap cleanup EXIT

mkdir -p "$RUN_DIR"
API_BASE="$(node -e "import('./ops/e2e/replay-local-api-matrix.mjs').then(({validateLoopbackUrl}) => process.stdout.write(validateLoopbackUrl(process.argv[1])))" "$API_INPUT")" || { api_matrix=FAIL; exit 1; }
API_PORT="${API_BASE##*:}"

adb -s "$SERIAL" get-state | grep -qx device || exit 1
adb -s "$SERIAL" shell pm path "$APP_ID" >/dev/null || exit 1
maestro_version="$(MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true maestro --version | tail -1 | tr -d '\r')"
[ "$maestro_version" = "$EXPECTED_MAESTRO_VERSION" ] || exit 1

# A new app process must never inherit an operational endpoint before Metro is local.
adb -s "$SERIAL" shell pm clear "$APP_ID" >/dev/null
mkdir -p "$RUN_DIR/raw"
EXPO_PUBLIC_API_BASE_URL="$API_BASE" npx expo start --dev-client --localhost --port "$METRO_PORT" >"$RUN_DIR/raw/metro.log" 2>&1 &
metro_pid=$!
for _ in $(seq 1 30); do
  curl --silent --fail "http://127.0.0.1:${METRO_PORT}/status" | grep -q 'packager-status:running' && break
  sleep 1
done
curl --silent --fail "http://127.0.0.1:${METRO_PORT}/status" | grep -q 'packager-status:running' || exit 1
tr '\0' '\n' <"/proc/${metro_pid}/environ" | grep -Fx "EXPO_PUBLIC_API_BASE_URL=${API_BASE}" >/dev/null || exit 1
adb -s "$SERIAL" reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}"
adb -s "$SERIAL" reverse "tcp:${API_PORT}" "tcp:${API_PORT}"

run_flow() {
  local name=$1 flow=$2
  shift 2
  MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true maestro --device "$SERIAL" "$@" test "$flow" >"$RUN_DIR/raw/${name}.log" 2>&1
}
run_flow native .maestro/native-smoke.yaml && native=PASS || native=FAIL

# Account parsing happens only after strict URL validation and only goes to Maestro's process env.
if [ -r "$ACCOUNT_FILE" ]; then
  mapfile -t credentials < <(node -e "const a=require(process.argv[1]); if(!a[0]?.email||!a[0]?.password)process.exit(1); console.log(a[0].email); console.log(a[0].password)" "$ACCOUNT_FILE")
  if [ "${#credentials[@]}" -eq 2 ]; then
    run_flow login .maestro/local-login-repro.yaml --env "E2E_EMAIL=${credentials[0]}" --env "E2E_PASSWORD=${credentials[1]}" && login=PASS || login=FAIL
  else login=FAIL; fi
else login=FAIL; fi
run_flow ai .maestro/local-ai-route-e2e.yaml && ai=UNEXPECTED_PASS || ai=FAIL
run_flow ride-offline .maestro/local-ride-offline-e2e.yaml && ride_offline=PARTIAL || ride_offline=PARTIAL
run_flow party .maestro/local-party-e2e.yaml && party=PARTIAL || party=PARTIAL

E2E_API_BASE_URL="$API_BASE" E2E_ACCOUNT_FILE="$ACCOUNT_FILE" E2E_API_EVIDENCE="$RUN_DIR/api-matrix.json" \
  node ops/e2e/replay-local-api-matrix.mjs >"$RUN_DIR/raw/api-matrix.log" 2>&1 && api_matrix=PASS || api_matrix=FAIL
write_manifest
printf 'E2E final status: %s\n' "$FINAL_MANIFEST"
# FAIL/PARTIAL are deliberately nonzero. The final manifest is still written atomically.
exit 1
