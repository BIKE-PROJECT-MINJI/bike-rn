'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const INSPECTOR = path.join(__dirname, 'inspect-android-artifact.sh');
const FINGERPRINT = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';

function makeFixture(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bike-aab-'));
  const artifact = path.join(dir, `${name}.aab`);
  // The fixture intentionally has AAB/protobuf entry names but no XML manifest. The
  // tool-aware bundletool fake supplies parsed output, proving the inspector never
  // treats a hand-authored XML ZIP as a successful Android artifact.
  fs.writeFileSync(artifact, Buffer.concat([
    Buffer.from('PK\\x03\\x04'),
    Buffer.from('BundleConfig.pb\\0base/manifest/AndroidManifest.xml\\0'),
    Buffer.from([0x0a, 0x00]),
  ]));
  return { artifact, dir };
}

function makeTools(dir) {
  const tools = path.join(dir, 'tools');
  fs.mkdirSync(tools);
  fs.writeFileSync(path.join(tools, 'bundletool'), `#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == *'dump manifest'* && "$*" == *'--bundle='* ]] || exit 97
case "$*" in
  *wrong-package*) echo '<manifest package="wrong.package" android:versionCode="1"><application android:debuggable="false" /></manifest>' ;;
  *wrong-version*) echo '<manifest package="com.bikeprojectminji.gaja" android:versionCode="2"><application android:debuggable="false" /></manifest>' ;;
  *debuggable*) echo '<manifest package="com.bikeprojectminji.gaja" android:versionCode="1"><application android:debuggable="true" /></manifest>' ;;
  *) echo '<manifest package="com.bikeprojectminji.gaja" android:versionCode="1"><application android:debuggable="false" /></manifest>' ;;
esac
`);
  fs.writeFileSync(path.join(tools, 'jarsigner'), `#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == *'-verify -strict'* ]] || exit 98
if [[ "$*" == *unsigned* || "$*" == *tampered* ]]; then exit 1; fi
`);
  fs.writeFileSync(path.join(tools, 'keytool'), `#!/usr/bin/env bash
set -euo pipefail
[[ "$*" == *'-printcert -jarfile'* ]] || exit 99
[[ "$*" == *wrong-signer* ]] && echo 'SHA256: 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00' || echo 'SHA256: ${FINGERPRINT}'
`);
  for (const name of ['bundletool', 'jarsigner', 'keytool']) fs.chmodSync(path.join(tools, name), 0o755);
  return tools;
}

function inspect(name, extra = {}) {
  const fixture = makeFixture(name);
  const tools = makeTools(fixture.dir);
  const result = spawnSync(INSPECTOR, [fixture.artifact], {
    encoding: 'utf8',
    env: {
      ...process.env,
      BUNDLETOOL: path.join(tools, 'bundletool'),
      PATH: `${tools}:${process.env.PATH}`,
      EXPECTED_AAB_PACKAGE: 'com.bikeprojectminji.gaja',
      EXPECTED_AAB_VERSION_CODE: '1',
      EXPECTED_UPLOAD_CERT_SHA256: FINGERPRINT,
      ...extra,
    },
  });
  fs.rmSync(fixture.dir, { recursive: true, force: true });
  return result;
}

test('accepts a protobuf-shaped AAB through bundletool and strict signature tools', () => {
  const result = inspect('valid');
  assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  assert.match(result.stdout, /AAB inspection PASS/);
});

for (const name of ['wrong-package', 'wrong-version', 'debuggable', 'unsigned', 'tampered', 'wrong-signer']) {
  test(`rejects ${name} artifact evidence`, () => {
    const result = inspect(name);
    assert.notEqual(result.status, 0, `${name} unexpectedly passed`);
  });
}

test('fails closed when expected versionCode or fingerprint is absent', () => {
  const result = inspect('valid', { EXPECTED_AAB_VERSION_CODE: '', EXPECTED_UPLOAD_CERT_SHA256: '' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EXPECTED_AAB_VERSION_CODE is required/);
});
