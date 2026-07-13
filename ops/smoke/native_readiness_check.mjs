#!/usr/bin/env node

import fs from 'node:fs';
import { execFile } from 'node:child_process';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const requireNativeDevice = process.env.REQUIRE_NATIVE_DEVICE === '1';

const checks = [];

function record(status, name, detail) {
  checks.push({ status, name, detail });
  console.log(`${status} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function run(command, args) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, { timeout: 5000 });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout || '').trim(),
      stderr: String(error.stderr || error.message || '').trim(),
    };
  }
}

const adb = await run('adb', ['devices', '-l']);
if (!adb.ok) {
  record('FAIL', 'adb devices', adb.stderr || 'adb command failed');
} else {
  const devices = adb.stdout
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.includes('offline') && !line.includes('unauthorized'));

  if (devices.length > 0) {
    record('PASS', 'adb device', devices.join(' | '));
  } else {
    record('BLOCKED', 'adb device', 'no connected authorized device');
  }
}

const emulatorPath = '/home/alstn/Android/Sdk/emulator/emulator';
if (fs.existsSync(emulatorPath)) {
  record('PASS', 'emulator binary', emulatorPath);
  const avds = await run(emulatorPath, ['-list-avds']);
  const names = avds.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  if (names.includes('gaja_wsl_api35')) {
    record('PASS', 'AVD gaja_wsl_api35', 'available');
  } else if (names.length > 0) {
    record('BLOCKED', 'AVD gaja_wsl_api35', `available AVDs: ${names.join(', ')}`);
  } else {
    record('BLOCKED', 'AVD gaja_wsl_api35', 'no AVDs listed');
  }
} else {
  record('BLOCKED', 'emulator binary', `${emulatorPath} missing`);
}

try {
  const stat = fs.statSync('/dev/kvm');
  const canReadWrite = fs.accessSync('/dev/kvm', fs.constants.R_OK | fs.constants.W_OK) === undefined;
  record(canReadWrite ? 'PASS' : 'BLOCKED', 'KVM access', `/dev/kvm mode ${stat.mode.toString(8)}`);
} catch (error) {
  record('BLOCKED', 'KVM access', error.message);
}

const blocked = checks.filter((check) => check.status === 'BLOCKED');
const failed = checks.filter((check) => check.status === 'FAIL');

if (failed.length > 0 || (requireNativeDevice && blocked.length > 0)) {
  console.error('\nNative readiness failed.');
  process.exit(1);
}

if (blocked.length > 0) {
  console.log('\nNative readiness is blocked, but public Expo readiness can still be tested.');
  console.log('Set REQUIRE_NATIVE_DEVICE=1 to make blocked native readiness fail the command.');
} else {
  console.log('\nNative readiness checks passed.');
}
