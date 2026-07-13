#!/usr/bin/env node

import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';

const publicOrigin = (process.env.PUBLIC_ORIGIN || 'https://rank-nonapplicative-fluidly.ngrok-free.dev').replace(/\/+$/, '');
const publicHost = new URL(publicOrigin).host;
const repoRoot = process.cwd();
const artifactsDir = path.resolve(repoRoot, '../../ARTIFACTS/expo-go-prototype-2026-06-24');
let androidLaunchAssetUrl = '';

const checks = [];

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  const marker = ok ? 'PASS' : 'FAIL';
  console.log(`${marker} ${name}${detail ? ` - ${detail}` : ''}`);
}

async function checkPort(name, host, port) {
  await new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 1500 }, () => {
      socket.destroy();
      record(name, true, `${host}:${port}`);
      resolve();
    });
    socket.on('timeout', () => {
      socket.destroy();
      record(name, false, `${host}:${port} timeout`);
      resolve();
    });
    socket.on('error', (error) => {
      record(name, false, `${host}:${port} ${error.code || error.message}`);
      resolve();
    });
  });
}

async function checkFetchJson(name, url, options, validate) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    if (!response.ok) {
      record(name, false, `HTTP ${response.status}`);
      return;
    }
    const data = JSON.parse(text);
    const detail = validate(data);
    record(name, true, detail);
  } catch (error) {
    record(name, false, error.message);
  }
}

async function checkFetchText(name, url, validate) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    if (!response.ok) {
      record(name, false, `HTTP ${response.status}`);
      return;
    }
    const detail = validate(text);
    record(name, true, detail);
  } catch (error) {
    record(name, false, error.message);
  }
}

async function checkFileContains(name, filePath, expected) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const normalized = content.trim();
    record(name, normalized === expected, normalized);
  } catch (error) {
    record(name, false, error.message);
  }
}

async function checkFileExists(name, filePath) {
  try {
    const stat = await fs.stat(filePath);
    record(name, stat.isFile(), path.relative(repoRoot, filePath));
  } catch (error) {
    record(name, false, error.message);
  }
}

await checkPort('backend port', '127.0.0.1', 8080);
await checkPort('metro port', '127.0.0.1', 8081);
await checkPort('expo proxy port', '127.0.0.1', 18080);

await checkFetchJson(
  'ngrok tunnel mapping',
  'http://127.0.0.1:4040/api/tunnels',
  undefined,
  (data) => {
    const tunnel = data?.tunnels?.find((candidate) => candidate?.public_url === publicOrigin);
    const target = tunnel?.config?.addr || '';
    if (!target.includes('18080')) {
      throw new Error(`expected ${publicOrigin} -> :18080, got ${target || 'missing tunnel'}`);
    }
    return `${publicOrigin} -> ${target}`;
  },
);

await checkFetchJson(
  'public health',
  `${publicOrigin}/health`,
  undefined,
  (data) => {
    if (data?.code !== 200 || data?.data?.service !== 'bike-back') {
      throw new Error(`unexpected health payload: ${JSON.stringify(data)}`);
    }
    return `${data.data.status}/${data.data.service}`;
  },
);

await checkFetchJson(
  'expo android manifest',
  publicOrigin,
  {
    headers: {
      'Expo-Platform': 'android',
      'Expo-Protocol-Version': '1',
    },
  },
  (data) => {
    const launchUrl = data?.launchAsset?.url || '';
    const hostUri = data?.extra?.expoClient?.hostUri || '';
    const debuggerHost = data?.extra?.expoGo?.debuggerHost || '';
    if (!launchUrl.includes(publicHost) || hostUri !== publicHost || debuggerHost !== publicHost) {
      throw new Error(`manifest not rewritten for ${publicHost}`);
    }
    androidLaunchAssetUrl = launchUrl;
    return publicHost;
  },
);

if (androidLaunchAssetUrl) {
  const sourceBundleUrl = new URL(androidLaunchAssetUrl);
  sourceBundleUrl.searchParams.set('transform.bytecode', '0');
  await checkFetchText('android js bundle markers', sourceBundleUrl.toString(), (text) => {
    const markers = ['fetchSystemHealth', 'homeRouteRequest', 'profileSessionSummary'];
    const missing = markers.filter((marker) => !text.includes(marker));
    if (missing.length > 0) {
      throw new Error(`missing markers: ${missing.join(', ')}`);
    }
    return markers.join(', ');
  });
}

await checkFetchText('public phone dashboard', `${publicOrigin}/prototype-dashboard`, (text) => {
  const markers = ['BIKE Expo Go 테스트', 'Expo Go로 열기', '폰 테스트 기록지', '완료 감사표', 'Expo Android manifest 확인 중'];
  const missing = markers.filter((marker) => !text.includes(marker));
  if (missing.length > 0) {
    throw new Error(`missing dashboard markers: ${missing.join(', ')}`);
  }
  return markers.join(', ');
});

await checkFetchText('public phone dashboard trailing slash', `${publicOrigin}/prototype-dashboard/`, (text) => {
  if (!text.includes('BIKE Expo Go 테스트')) {
    throw new Error('trailing slash dashboard route did not return dashboard HTML');
  }
  return 'dashboard HTML';
});

try {
  const response = await fetch(`${publicOrigin}/prototype-artifacts/expo-go-qr.png`, { method: 'HEAD' });
  const contentType = response.headers.get('content-type') || '';
  record('public dashboard QR asset', response.ok && contentType.includes('image/png'), contentType || `HTTP ${response.status}`);
} catch (error) {
  record('public dashboard QR asset', false, error.message);
}

await checkFetchText(
  'public phone checklist',
  `${publicOrigin}/prototype-artifacts/${encodeURIComponent('폰_테스트_기록지.md')}`,
  (text) => {
    if (!text.includes('최소 통과 기준')) {
      throw new Error('phone checklist missing pass criteria');
    }
    return '최소 통과 기준';
  },
);

await checkFetchText(
  'public completion audit',
  `${publicOrigin}/prototype-artifacts/${encodeURIComponent('완료_감사표.md')}`,
  (text) => {
    if (!text.includes('요구사항별 감사')) {
      throw new Error('completion audit missing audit table');
    }
    return '요구사항별 감사';
  },
);

await checkFetchText(
  'public detailed test guide',
  `${publicOrigin}/prototype-artifacts/${encodeURIComponent('테스트_안내.md')}`,
  (text) => {
    if (!text.includes('폰에서 확인할 최소 시나리오')) {
      throw new Error('test guide missing minimum scenario');
    }
    return '폰에서 확인할 최소 시나리오';
  },
);

await checkFileContains(
  'expo go url artifact',
  path.join(artifactsDir, 'expo-go-url.txt'),
  `exps://${publicHost}`,
);
await checkFileExists('expo go qr png', path.join(artifactsDir, 'expo-go-qr.png'));
await checkFileExists('phone test checklist', path.join(artifactsDir, '폰_테스트_기록지.md'));
await checkFileExists('completion audit', path.join(artifactsDir, '완료_감사표.md'));

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`\n${failed.length} readiness check(s) failed.`);
  process.exit(1);
}

console.log('\nPrototype public readiness checks passed.');
