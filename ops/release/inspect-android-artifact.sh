#!/usr/bin/env bash
set -euo pipefail

artifact=${1:?usage: inspect-android-artifact.sh path/to/app.aab}
: "${EXPECTED_AAB_PACKAGE:?EXPECTED_AAB_PACKAGE is required}"
: "${EXPECTED_AAB_VERSION_CODE:?EXPECTED_AAB_VERSION_CODE is required}"
: "${EXPECTED_UPLOAD_CERT_SHA256:?EXPECTED_UPLOAD_CERT_SHA256 is required}"

bundletool=${BUNDLETOOL:-bundletool}
command -v "$bundletool" >/dev/null 2>&1 || { echo "bundletool is required; refusing raw ZIP/XML inspection" >&2; exit 2; }
command -v jarsigner >/dev/null 2>&1 || { echo "jarsigner is required" >&2; exit 2; }
command -v keytool >/dev/null 2>&1 || { echo "keytool is required" >&2; exit 2; }
[[ -f "$artifact" && "$artifact" == *.aab ]] || { echo "expected an existing .aab artifact" >&2; exit 2; }
[[ "$EXPECTED_AAB_VERSION_CODE" =~ ^[1-9][0-9]*$ ]] || { echo "EXPECTED_AAB_VERSION_CODE must be a positive integer" >&2; exit 2; }
[[ "$EXPECTED_UPLOAD_CERT_SHA256" =~ ^[0-9A-Fa-f:]{64,95}$ ]] || { echo "EXPECTED_UPLOAD_CERT_SHA256 must be a SHA-256 fingerprint" >&2; exit 2; }

jarsigner -verify -strict "$artifact"
manifest=$("$bundletool" dump manifest --bundle="$artifact")
parsed=$(node - "$manifest" <<'NODE'
const xml = process.argv[2];
const manifest = xml.match(/<manifest\b[^>]*>/i)?.[0] || '';
const attr = (name) => manifest.match(new RegExp(`\\b${name}=["']([^"']+)["']`, 'i'))?.[1] || '';
const application = xml.match(/<application\b[^>]*>/i)?.[0] || '';
console.log(JSON.stringify({
  packageName: attr('package'),
  versionCode: attr('android:versionCode'),
  debuggable: /\bandroid:debuggable=["']true["']/i.test(application) ? 'true' : 'false',
}));
NODE
)
package_name=$(node -e 'console.log(JSON.parse(process.argv[1]).packageName)' "$parsed")
version_code=$(node -e 'console.log(JSON.parse(process.argv[1]).versionCode)' "$parsed")
debuggable=$(node -e 'console.log(JSON.parse(process.argv[1]).debuggable)' "$parsed")
[[ "$package_name" == "$EXPECTED_AAB_PACKAGE" ]] || { echo "package mismatch: $package_name" >&2; exit 1; }
[[ "$version_code" == "$EXPECTED_AAB_VERSION_CODE" ]] || { echo "versionCode mismatch: $version_code" >&2; exit 1; }
[[ "$debuggable" == false ]] || { echo "debuggable artifact rejected" >&2; exit 1; }

actual_fingerprint=$(keytool -printcert -jarfile "$artifact" | sed -nE 's/^[[:space:]]*SHA256:[[:space:]]*//p' | head -n1 | tr -d ':[:space:]' | tr '[:lower:]' '[:upper:]')
expected_fingerprint=$(printf '%s' "$EXPECTED_UPLOAD_CERT_SHA256" | tr -d ':[:space:]' | tr '[:lower:]' '[:upper:]')
[[ -n "$actual_fingerprint" && "$actual_fingerprint" == "$expected_fingerprint" ]] || { echo "upload certificate SHA-256 mismatch" >&2; exit 1; }
printf 'AAB inspection PASS: package=%s versionCode=%s debuggable=%s\n' "$package_name" "$version_code" "$debuggable"
