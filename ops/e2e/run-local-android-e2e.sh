#!/usr/bin/env bash
# Local-only Android free-ride save regression gate for Issue #12.
# It creates only transient local credentials and never persists raw payloads,
# tokens, coordinates, or account identifiers in tracked evidence.
set -euo pipefail

readonly SERIAL="${ANDROID_SERIAL:-emulator-5554}"
readonly APP_ID="${E2E_APP_ID:-com.bikeprojectminji.gaja}"
readonly API_BASE="${E2E_API_BASE_URL:-http://127.0.0.1:8080}"
readonly METRO_PORT="${E2E_METRO_PORT:-8081}"
readonly ARTIFACT_ROOT="${E2E_ARTIFACT_ROOT:-ops/e2e/artifacts/T-RN-12}"
readonly RUN_ID="${E2E_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
readonly RUN_DIR="${ARTIFACT_ROOT}/${RUN_ID}"
readonly STATUS_FILE="${RUN_DIR}/status.json"

metro_pid=""
created_account=false
email=""
password=""

fail() { printf 'T-RN-12 E2E failed: %s\n' "$*" >&2; exit 1; }

write_status() {
  mkdir -p "$RUN_DIR"
  node - "$STATUS_FILE" "$RUN_ID" "$1" "$2" <<'NODE'
const [out, runId, outcome, detail] = process.argv.slice(2);
require('fs').writeFileSync(out, `${JSON.stringify({ testId: 'T-RN-12', runId, outcome, detail }, null, 2)}\n`, { mode: 0o600 });
NODE
}

cleanup() {
  local code=$?
  [ -n "$metro_pid" ] && kill -- "-$metro_pid" 2>/dev/null || true
  # Maestro output includes typed values, so it is deliberately never retained.
  rm -rf "$RUN_DIR/raw"
  if [ "$created_account" = true ]; then
    unset email password
  fi
  exit "$code"
}
trap cleanup EXIT

case "$API_BASE" in
  http://127.0.0.1:[0-9]*|http://localhost:[0-9]*) ;;
  *) fail 'E2E_API_BASE_URL must be an exact local HTTP loopback URL' ;;
esac

adb -s "$SERIAL" get-state | grep -qx device || fail 'Android emulator is unavailable'
adb -s "$SERIAL" shell pm path "$APP_ID" >/dev/null || fail 'GAJA development build is unavailable'
curl --fail --silent --show-error "$API_BASE/ready" >/dev/null || fail 'local backend /ready is not 200'
MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true maestro --version | grep -qx '2.7.0' || fail 'Maestro 2.7.0 is required'
test -x node_modules/.bin/expo || fail 'local Expo CLI is unavailable; install locked dependencies before E2E'

mkdir -p "$RUN_DIR/raw"
write_status FAIL 'started'
adb -s "$SERIAL" reverse "tcp:8080" "tcp:8080"
adb -s "$SERIAL" reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}"
adb -s "$SERIAL" shell pm grant "$APP_ID" android.permission.ACCESS_FINE_LOCATION || fail 'could not grant fine location'
adb -s "$SERIAL" shell pm grant "$APP_ID" android.permission.ACCESS_BACKGROUND_LOCATION || fail 'could not grant background location'

# Use a fresh local-only account so no credential injection is required. It is
# never written to disk and Metro/Maestro raw logs are removed in cleanup.
email="ride-e2e-${RUN_ID}@local.test"
password="LocalRide-${RUN_ID}-aA1!"
created_account=true

EXPO_PUBLIC_API_BASE_URL="$API_BASE" setsid node_modules/.bin/expo start --dev-client --localhost --port "$METRO_PORT" >"$RUN_DIR/raw/metro.log" 2>&1 &
metro_pid=$!
for _ in $(seq 1 45); do
  curl --silent --fail "http://127.0.0.1:${METRO_PORT}/status" | grep -q 'packager-status:running' && break
  sleep 1
done
curl --silent --fail "http://127.0.0.1:${METRO_PORT}/status" | grep -q 'packager-status:running' || fail 'Metro did not start'

adb -s "$SERIAL" shell am force-stop "$APP_ID"
adb -s "$SERIAL" shell am start -a android.intent.action.VIEW -d "exp+bike-rn://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A${METRO_PORT}" >/dev/null || fail 'could not open local development bundle'

cat >"$RUN_DIR/raw/free-ride-save.yaml" <<'YAML'
appId: com.bikeprojectminji.gaja
---
- extendedWaitUntil:
    visible: "홈"
    timeout: 30000
- tapOn: "마이"
- tapOn: "회원가입"
- tapOn: "이메일"
- inputText: ${E2E_EMAIL}
- tapOn: "비밀번호"
- inputText: ${E2E_PASSWORD}
- tapOn: "화면에 표시할 이름"
- inputText: "Local Ride"
- pressKey: Back
- tapOn: "계정 만들기"
- assertVisible: "로그인됨"
- tapOn: "홈"
- tapOn: "자유주행 시작"
- tapOn: "자유주행 시작"
- assertVisible: "주행 기록 중입니다. 화면을 잠가도 로컬에 계속 저장합니다."
YAML

MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true maestro --device "$SERIAL" --env "E2E_EMAIL=$email" --env "E2E_PASSWORD=$password" test "$RUN_DIR/raw/free-ride-save.yaml" >"$RUN_DIR/raw/flow.log" 2>&1 || fail 'authentication/start UI flow failed'

# The backend rejects a trace without a plausible contiguous pair. The two
# emulator points are ~11m apart, injected seconds apart, and use real event
# timestamps from Android location services.
adb -s "$SERIAL" emu geo fix 126.9500 37.4800 >/dev/null
sleep 3
adb -s "$SERIAL" emu geo fix 126.9501 37.4801 >/dev/null
sleep 3

cat >"$RUN_DIR/raw/end-save.yaml" <<'YAML'
appId: com.bikeprojectminji.gaja
---
- tapOn: "종료"
- tapOn: "종료 및 저장"
- extendedWaitUntil:
    visible: "서버 저장 완료. 주행 기록을 보정하고 있습니다."
    timeout: 30000
- extendedWaitUntil:
    visible: "주행 기록 보정이 완료됐습니다."
    timeout: 45000
- assertNotVisible: "서버가 주행 데이터를 처리하지 못했습니다. 로컬 기록은 유지됩니다."
YAML

MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true maestro --device "$SERIAL" test "$RUN_DIR/raw/end-save.yaml" >"$RUN_DIR/raw/end-save.log" 2>&1 || fail 'save did not transition FINALIZING to READY in the UI'

write_status PASS 'authenticated_UI_two_GPS_samples_FINALIZING_to_READY'
printf 'T-RN-12 local Android E2E passed: %s\n' "$STATUS_FILE"
