#!/usr/bin/env node
// Local-only API replay. Output contains outcomes only; never write credentials,
// tokens, backend IDs, addresses, route points, or precise coordinates.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function validateLoopbackUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('E2E_API_BASE_URL must be an absolute loopback URL'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
    || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('E2E_API_BASE_URL must be exactly http://127.0.0.1:<port> or http://localhost:<port>');
  }
  const port = Number(url.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('E2E_API_BASE_URL has an invalid port');
  return `${url.protocol}//${url.hostname}:${port}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const resultPath = () => process.env.E2E_API_EVIDENCE ?? 'ops/e2e/artifacts/T-RN-E2E-01/api-matrix/status.json';
const safeWrite = (out, result) => {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const temporary = `${out}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, out);
};

export async function runReplay({ base, accounts }) {
  const request = async (pathname, { token, method = 'GET', body } = {}) => {
    const response = await fetch(`${base}${pathname}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, payload: await response.json().catch(() => null) };
  };
  const login = async (account) => {
    const value = await request('/api/v1/auth/login', { method: 'POST', body: { email: account.email, password: account.password } });
    if (value.status !== 200 || !value.payload?.data?.accessToken) throw new Error(`login failed: HTTP ${value.status}`);
    return value.payload.data.accessToken;
  };
  if (!Array.isArray(accounts) || accounts.length < 2 || !accounts[0]?.email || !accounts[0]?.password || !accounts[1]?.email || !accounts[1]?.password) {
    throw new Error('account file must contain two local test accounts with email and password');
  }
  const accountsDiffer = accounts[0].email !== accounts[1].email;
  if (!accountsDiffer) throw new Error('the two local test accounts must differ');
  const ready = await request('/ready');
  if (ready.status !== 200) throw new Error(`/ready must return 200; got ${ready.status}`);
  const [first, second] = await Promise.all(accounts.slice(0, 2).map(login));
  const now = Date.now();
  const iso = (offset) => new Date(now + offset).toISOString();
  // Coarse fixture coordinates are deliberately not persisted in evidence.
  const ride = { clientRideId: `e2e-${now}`, startedAt: iso(-65_000), endedAt: iso(0), summary: { distanceM: 120, durationSec: 65 }, routePoints: [
    { pointOrder: 1, latitude: 37.48, longitude: 126.95, capturedAt: iso(-65_000), accuracyM: 8, speedMps: 2, bearingDeg: 45 },
    { pointOrder: 2, latitude: 37.49, longitude: 126.96, capturedAt: iso(0), accuracyM: 8, speedMps: 2, bearingDeg: 45 },
  ] };
  const saved = await request('/api/v1/ride-records', { token: first, method: 'POST', body: ride });
  const duplicate = await request('/api/v1/ride-records', { token: first, method: 'POST', body: ride });
  const recordId = saved.payload?.data?.rideRecordId;
  const statuses = [];
  if (recordId) for (let i = 0; i < 15; i += 1) {
    const value = await request(`/api/v1/ride-records/${recordId}`, { token: first });
    statuses.push(value.payload?.data?.status ?? `HTTP_${value.status}`);
    if (statuses.at(-1) === 'READY') break;
    await sleep(1000);
  }
  const courses = await request('/api/v1/courses?limit=1', { token: first });
  const courseId = courses.payload?.data?.items?.[0]?.id;
  let party = { create: null, join: null, start: null, members: null };
  if (courseId) {
    party.create = await request('/api/v1/parties', { token: first, method: 'POST', body: { courseId, title: 'Local E2E Party', capacity: 3 } });
    const partyId = party.create.payload?.data?.id;
    if (partyId) {
      party.join = await request(`/api/v1/parties/${partyId}/join`, { token: second, method: 'POST' });
      party.start = await request(`/api/v1/parties/${partyId}/start`, { token: first, method: 'POST' });
      party.members = await request(`/api/v1/parties/${partyId}/members`, { token: first });
    }
  }
  const result = { testId: 'T-RN-E2E-01', readyHttp: ready.status, accountsDiffer, loginHttp: 200,
    rideSaveHttp: saved.status, duplicateSaveHttp: duplicate.status,
    sameBackendRecord: Boolean(recordId && recordId === duplicate.payload?.data?.rideRecordId),
    finalizationStatuses: statuses, party: { createHttp: party.create?.status ?? null, joinHttp: party.join?.status ?? null, startHttp: party.start?.status ?? null,
      memberCount: Array.isArray(party.members?.payload?.data?.items) ? party.members.payload.data.items.length : null } };
  const pass = result.readyHttp === 200 && result.accountsDiffer && result.rideSaveHttp === 200 && result.duplicateSaveHttp === 200
    && result.sameBackendRecord && result.finalizationStatuses.includes('READY') && result.party.createHttp === 200
    && result.party.joinHttp === 200 && result.party.startHttp === 200 && result.party.memberCount === 2;
  return { result: { ...result, outcome: pass ? 'PASS' : 'FAIL' }, pass };
}

export async function main() {
  // Validate before any account-file read or network request.
  const base = validateLoopbackUrl(process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8080');
  const accountFile = process.env.E2E_ACCOUNT_FILE ?? '/tmp/t-rn-e2e-accounts.json';
  const out = resultPath();
  let result;
  try {
    const accounts = JSON.parse(fs.readFileSync(accountFile, 'utf8'));
    ({ result } = await runReplay({ base, accounts }));
  } catch (error) {
    result = { testId: 'T-RN-E2E-01', outcome: 'FAIL', failure: error instanceof Error ? error.message : 'unknown replay failure' };
  }
  safeWrite(out, result);
  console.log(JSON.stringify(result));
  if (result.outcome !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
