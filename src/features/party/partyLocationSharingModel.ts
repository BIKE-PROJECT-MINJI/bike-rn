import type { LocationObject } from 'expo-location';
import type { RidePartyLocation } from '../../domain/party/partyModels';
import { ApiClientError } from '../../shared/api/apiClient';

export type PartyLocationPayload = {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyM: number | null;
  readonly speedMps: number | null;
  readonly bearingDeg: number | null;
  readonly capturedAt: string;
};

export function toPartyLocationPayload(location: LocationObject): PartyLocationPayload {
  const bearing = location.coords.heading;
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracyM: location.coords.accuracy,
    speedMps: location.coords.speed === null ? null : Math.max(0, location.coords.speed),
    bearingDeg: bearing === null || bearing < 0 || bearing >= 360 ? null : bearing,
    capturedAt: new Date(location.timestamp).toISOString(),
  };
}

export function partyReconnectDelayMs(attempt: number): number {
  return Math.min(10_000, 1_000 * 2 ** Math.max(0, Math.min(attempt, 4)));
}

export function visiblePartyLocations(
  locations: ReadonlyMap<number, RidePartyLocation>,
  nowMs: number,
): ReadonlyMap<number, RidePartyLocation> {
  const visible = new Map<number, RidePartyLocation>();
  for (const [userId, location] of locations) {
    const capturedAtMs = Date.parse(location.capturedAt);
    if (Number.isFinite(capturedAtMs) && nowMs - capturedAtMs <= PARTY_LOCATION_TTL_MS) {
      visible.set(userId, location);
    }
  }
  return visible;
}

export function shouldRetryPartyLocationError(error: unknown): boolean {
  if (!(error instanceof ApiClientError)) {
    return false;
  }
  return error.status === null || error.status === 408 || error.status === 429 || error.status >= 500;
}

export function shouldReconnectPartySocket(closeCode: number): boolean {
  return closeCode !== 1000 && closeCode !== 1008;
}

const PARTY_LOCATION_TTL_MS = 20_000;
