const assert = require('node:assert/strict');
const test = require('node:test');

const {
  addGoogleMapsMetaData,
  addGoogleMapsReleaseGate,
} = require('./with-google-maps-key-guard');

test('adds the Google Maps manifest placeholder exactly once', () => {
  const manifest = {
    manifest: {
      application: [{ $: { 'android:name': '.MainApplication' } }],
    },
  };

  addGoogleMapsMetaData(manifest);
  addGoogleMapsMetaData(manifest);

  const metadata = manifest.manifest.application[0]['meta-data'];
  assert.equal(metadata.length, 1);
  assert.equal(metadata[0].$['android:name'], 'com.google.android.geo.API_KEY');
  assert.equal(metadata[0].$['android:value'], '${GOOGLE_MAPS_API_KEY}');
});

test('adds one release build gate without embedding a key', () => {
  const source = 'plugins {\n  id "com.android.application"\n}\n';

  const once = addGoogleMapsReleaseGate(source);
  const twice = addGoogleMapsReleaseGate(once);

  assert.equal(once, twice);
  assert.match(once, /environmentVariable\("GOOGLE_MAPS_ANDROID_API_KEY"\)/);
  assert.doesNotMatch(once, /gradleProperty\(/);
  assert.match(once, /debug-only-missing-google-maps-key/);
  assert.match(once, /Google Maps Android API key is required for release builds/);
  assert.equal(once.includes('AIza'), false);
});
