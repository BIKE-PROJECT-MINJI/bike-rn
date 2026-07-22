const assert = require('node:assert/strict');
const test = require('node:test');

const {
  addAndroidReleaseSigningGate,
} = require('./with-android-release-signing');

test('injects one environment-only Android release signing gate', () => {
  const source = 'plugins {\n  id "com.android.application"\n}\n';

  const once = addAndroidReleaseSigningGate(source);
  const twice = addAndroidReleaseSigningGate(once);

  assert.equal(once, twice);
  assert.match(once, /environmentVariable\("GAJA_ANDROID_UPLOAD_KEYSTORE_PATH"\)/);
  assert.match(once, /environmentVariable\("GAJA_ANDROID_UPLOAD_STORE_PASSWORD"\)/);
  assert.match(once, /environmentVariable\("GAJA_ANDROID_UPLOAD_KEY_ALIAS"\)/);
  assert.match(once, /environmentVariable\("GAJA_ANDROID_UPLOAD_KEY_PASSWORD"\)/);
  assert.match(once, /signingConfig signingConfigs\.gajaRelease/);
  assert.match(once, /GAJA Android upload signing credentials are required for release builds/);
  assert.equal(once.includes('gaja-upload.jks'), false);
});
