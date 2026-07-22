#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const CANONICAL_PACKAGE = 'com.bikeprojectminji.gaja';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const GOOGLE_KEY = /AIza[0-9A-Za-z_-]{35}/;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function fail(errors, message) {
  errors.push(message);
}

function visitStrings(value, label, callback) {
  if (typeof value === 'string') return callback(value, label);
  if (Array.isArray(value)) return value.forEach((item, index) => visitStrings(item, `${label}[${index}]`, callback));
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => visitStrings(item, `${label}.${key}`, callback));
  }
}

const app = readJson('app.json');
const eas = readJson('eas.json');
const pkg = readJson('package.json');
const expo = app.expo || {};
const android = expo.android || {};
const production = eas.build && eas.build.production;
const errors = [];

if (!SEMVER.test(expo.version || '')) fail(errors, 'expo.version must be valid SemVer.');
if (expo.version !== pkg.version) fail(errors, 'expo.version must equal package.json version.');
if (android.package !== CANONICAL_PACKAGE) fail(errors, `android.package must be ${CANONICAL_PACKAGE}.`);
if (!Number.isInteger(android.versionCode) || android.versionCode < 1) fail(errors, 'android.versionCode must be a positive integer.');
if (!production || !production.android) fail(errors, 'eas.json must define build.production.android.');
if (!production || !production.android || production.android.buildType !== 'app-bundle') fail(errors, 'production Android buildType must be app-bundle.');
if (!production || !production.android || production.android.credentialsSource !== 'remote') fail(errors, 'production Android credentialsSource must be remote (configuration only; not signing proof).');

visitStrings({ app, eas }, 'releaseConfig', (value, label) => {
  if (GOOGLE_KEY.test(value)) fail(errors, `actual Google Maps API key detected at ${label}.`);
});

const pluginPath = path.join(ROOT, 'plugins/with-google-maps-key-guard.js');
const plugin = fs.readFileSync(pluginPath, 'utf8');
if (!plugin.includes('providers.environmentVariable("GOOGLE_MAPS_ANDROID_API_KEY")')) fail(errors, 'Maps key guard must use the EAS build environment variable.');
if (plugin.includes('gradleProperty("GOOGLE_MAPS_ANDROID_API_KEY")')) fail(errors, 'Maps key guard must not accept a Gradle property bypass.');

const configuredProjectId = expo.extra && expo.extra.eas && expo.extra.eas.projectId;
const approvedProjectId = process.env.APPROVED_EAS_PROJECT_ID;
if (!UUID.test(approvedProjectId || '')) {
  fail(errors, 'APPROVED_EAS_PROJECT_ID is required and must be an approved public UUID; no project binding was invented.');
} else if (!UUID.test(configuredProjectId || '')) {
  fail(errors, 'expo.extra.eas.projectId is required and must be an approved public UUID.');
} else if (configuredProjectId !== approvedProjectId) {
  fail(errors, 'expo.extra.eas.projectId does not match APPROVED_EAS_PROJECT_ID.');
}

if (errors.length) {
  console.error('Production release configuration: FAIL');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('Production release configuration: PASS');
  console.log('Remote credentials are configured; artifact signing identity still requires separate certificate evidence.');
}
