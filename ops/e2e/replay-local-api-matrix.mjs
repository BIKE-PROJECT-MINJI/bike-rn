#!/usr/bin/env node
// Local-only backend evidence: it deliberately writes status/counts, never credentials,
// tokens, server IDs, route points, addresses, or precise coordinates.
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8080';
const accountFile = process.env.E2E_ACCOUNT_FILE ?? '/tmp/t-rn-e2e-accounts.json';
const out = process.env.E2E_API_EVIDENCE ?? 'ops/e2e/artifacts/T-RN-E2E-01/api-matrix/status.json';
const accounts = JSON.parse(fs.readFileSync(accountFile, 'utf8'));
const request = async (pathname, { token, method = 'GET', body } = {}) => {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
};
const login = async (account) => {
  const result = await request('/api/v1/auth/login', { method: 'POST', body: { email: account.email, password: account.password } });
  if (result.status !== 200 || !result.payload?.data?.accessToken) throw new Error(`login failed: HTTP ${result.status}`);
  return result.payload.data.accessToken;
};
const now = Date.now();
const iso = (offset) => new Date(now + offset).toISOString();
const main = async () => {
  const [first, second] = await Promise.all(accounts.slice(0, 2).map(login));
  const ready = await request('/ready');
  const clientRideId = `e2e-${now}`;
  const ride = {
    clientRideId,
    startedAt: iso(-65_000), endedAt: iso(0), summary: { distanceM: 120, durationSec: 65 },
    routePoints: [
      { pointOrder: 1, latitude: 37.48, longitude: 126.95, capturedAt: iso(-65_000), accuracyM: 8, speedMps: 2, bearingDeg: 45, altitudeM: null, distanceToRouteM: null, routeProgressPct: null },
      { pointOrder: 2, latitude: 37.49, longitude: 126.96, capturedAt: iso(0), accuracyM: 8, speedMps: 2, bearingDeg: 45, altitudeM: null, distanceToRouteM: null, routeProgressPct: null },
    ],
  };
  const saved = await request('/api/v1/ride-records', { token: first, method: 'POST', body: ride });
  const duplicate = await request('/api/v1/ride-records', { token: first, method: 'POST', body: ride });
  const recordId = saved.payload?.data?.rideRecordId;
  const statuses = [];
  if (recordId) for (let i = 0; i < 10; i += 1) { const value = await request(`/api/v1/ride-records/${recordId}`, { token: first }); statuses.push(value.payload?.data?.status ?? `HTTP_${value.status}`); if (statuses.at(-1) === 'READY') break; await new Promise((resolve) => setTimeout(resolve, 1000)); }
  const courses = await request('/api/v1/courses?limit=1', { token: first });
  const courseId = courses.payload?.data?.items?.[0]?.id;
  let party = { create: null, join: null, start: null, members: null };
  if (courseId) {
    party.create = await request('/api/v1/parties', { token: first, method: 'POST', body: { courseId, title: 'Local E2E Party', capacity: 3 } });
    const partyId = party.create.payload?.data?.id;
    if (partyId) { party.join = await request(`/api/v1/parties/${partyId}/join`, { token: second, method: 'POST' }); party.start = await request(`/api/v1/parties/${partyId}/start`, { token: first, method: 'POST' }); party.members = await request(`/api/v1/parties/${partyId}/members`, { token: first }); }
  }
  const result = {
    testId: 'T-RN-E2E-01', readyHttp: ready.status, loginHttp: 200,
    rideSaveHttp: saved.status, duplicateSaveHttp: duplicate.status,
    sameBackendRecord: Boolean(recordId && recordId === duplicate.payload?.data?.rideRecordId),
    finalizationStatuses: statuses, party: { createHttp: party.create?.status ?? null, joinHttp: party.join?.status ?? null, startHttp: party.start?.status ?? null, memberCount: Array.isArray(party.members?.payload?.data?.items) ? party.members.payload.data.items.length : null },
  };
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result));
  if (saved.status !== 200 || duplicate.status !== 200 || !result.sameBackendRecord) process.exitCode = 1;
};
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
