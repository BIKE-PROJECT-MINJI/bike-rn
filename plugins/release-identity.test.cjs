const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const appConfig = require(path.resolve(__dirname, '..', 'app.json'));

test('pins the production Android identity and first store version', () => {
  const expo = appConfig.expo;

  assert.equal(expo.name, 'GAJA');
  assert.equal(expo.version, '1.0.0');
  assert.equal(expo.android.package, 'com.bikeprojectminji.gaja');
  assert.equal(expo.android.versionCode, 1);
});
