#!/usr/bin/env bash
# Reproducible local Android E2E gate.  It never starts or calls a backend by itself.
set -euo pipefail

readonly TEST_ID="${E2E_TEST_ID:-T-RN-E2E-01}"
readonly SERIAL="${ANDROID_SERIAL:-emulator-5554}"
readonly APP_ID="${E2E_APP_ID:-com.bikeprojectminji.gaja}"
readonly EXPECTED_MAESTRO_VERSION="2.7.0"
readonly ARTIFACT_DIR="${E2E_ARTIFACT_DIR:-ops/e2e/artifacts/${TEST_ID}}"

fail() { printf '%s FAIL %s\n' "$TEST_ID" "$*" >&2; exit 1; }
redact() { sed -E 's/(Bearer )[[:alnum:]._-]+/\1[REDACTED]/g; s/(token|access_token|refresh_token)=[^[:space:]&]+/\1=[REDACTED]/gi; s/-?[0-9]{1,3}\.[0-9]{4,}/[REDACTED_COORD]/g'; }

mkdir -p "$ARTIFACT_DIR"
adb -s "$SERIAL" get-state | grep -qx device || fail "Android device $SERIAL is not ready"
adb -s "$SERIAL" shell pm path "$APP_ID" >/dev/null || fail "$APP_ID is not installed"
api_level="$(adb -s "$SERIAL" shell getprop ro.build.version.sdk | tr -d '\r')"
maestro_version="$(MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true maestro --version | tail -1 | tr -d '\r')"
[ "$maestro_version" = "$EXPECTED_MAESTRO_VERSION" ] || fail "Maestro $EXPECTED_MAESTRO_VERSION required; found $maestro_version"

{
  printf 'test_id=%s\nserial=%s\napi_level=%s\napp_id=%s\nmaestro=%s\ncommit=%s\n' \
    "$TEST_ID" "$SERIAL" "$api_level" "$APP_ID" "$maestro_version" "$(git rev-parse HEAD)"
  adb -s "$SERIAL" shell dumpsys package "$APP_ID" | grep -E 'versionCode=|versionName=|lastUpdateTime=' || true
} | redact > "$ARTIFACT_DIR/environment.txt"

MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true maestro --device "$SERIAL" test .maestro/native-smoke.yaml \
  2>&1 | redact | tee "$ARTIFACT_DIR/native-smoke.log"

# Integration evidence is intentionally unavailable until backend PR #88 is merged
# and the coordinator fixes main.  The explicit flag prevents accidental calls to
# a stale, AWS, or paid-provider endpoint.
if [ "${BIKE_BACKEND_MAIN_READY:-0}" != "1" ]; then
  printf '%s PARTIAL native smoke passed; backend journey deliberately blocked pending merged backend main\n' "$TEST_ID" \
    | tee "$ARTIFACT_DIR/status.txt"
  exit 0
fi

[ -n "${E2E_API_BASE_URL:-}" ] || fail "E2E_API_BASE_URL is required after backend-main readiness"
[ "${E2E_ALLOW_LOCALHOST_ONLY:-0}" = "1" ] || fail "set E2E_ALLOW_LOCALHOST_ONLY=1 only for coordinator-approved local backend"

# The following IDs connect screenshots/UI, HTTP capture and backend-state export
# without logging tokens, IDs, or precise coordinates.  The credentialed actions
# remain a coordinator-run step because this worker has no approved local account.
printf '%s UNVERIFIED credentialed flow requires approved local test account and backend evidence bundle\n' "$TEST_ID" \
  | tee "$ARTIFACT_DIR/status.txt"
exit 0
