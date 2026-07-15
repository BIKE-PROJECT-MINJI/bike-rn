import { ApiClientError } from '../../shared/api/apiClient';
import type { RidePartyLocation } from '../../domain/party/partyModels';
import {
  partyReconnectDelayMs,
  shouldReconnectPartySocket,
  shouldRetryPartyLocationError,
  toPartyLocationPayload,
  visiblePartyLocations,
} from './partyLocationSharingModel';

describe('party location sharing model', () => {
  it('caps reconnect backoff at ten seconds', () => {
    expect([0, 1, 2, 3, 4, 5].map(partyReconnectDelayMs)).toEqual([1_000, 2_000, 4_000, 8_000, 10_000, 10_000]);
  });

  it('normalizes an invalid device heading without changing coordinates', () => {
    const payload = toPartyLocationPayload({
      coords: {
        latitude: 37.52,
        longitude: 126.92,
        altitude: null,
        accuracy: 5,
        altitudeAccuracy: null,
        heading: -1,
        speed: -1,
      },
      timestamp: Date.parse('2026-07-15T03:00:00Z'),
    });

    expect(payload).toMatchObject({ latitude: 37.52, longitude: 126.92, bearingDeg: null, speedMps: 0 });
  });

  it('removes a party location after the twenty second freshness window', () => {
    const nowMs = Date.parse('2026-07-15T03:00:30Z');
    const locations = new Map<number, RidePartyLocation>([
      [1, location(1, '2026-07-15T03:00:11Z')],
      [2, location(2, '2026-07-15T03:00:09Z')],
    ]);

    expect([...visiblePartyLocations(locations, nowMs).keys()]).toEqual([1]);
  });

  it('retries only transient token failures', () => {
    expect(shouldRetryPartyLocationError(new ApiClientError({ message: 'unauthorized', status: 401 }))).toBe(false);
    expect(shouldRetryPartyLocationError(new ApiClientError({ message: 'forbidden', status: 403 }))).toBe(false);
    expect(shouldRetryPartyLocationError(new ApiClientError({ message: 'busy', status: 503 }))).toBe(true);
    expect(shouldRetryPartyLocationError(new ApiClientError({ message: 'network', status: null }))).toBe(true);
  });

  it('does not reconnect a normal close or policy violation', () => {
    expect(shouldReconnectPartySocket(1000)).toBe(false);
    expect(shouldReconnectPartySocket(1008)).toBe(false);
    expect(shouldReconnectPartySocket(1006)).toBe(true);
  });
});

function location(userId: number, capturedAt: string): RidePartyLocation {
  return {
    partyId: 20,
    userId,
    latitude: 37.52,
    longitude: 126.92,
    accuracyM: 5,
    speedMps: 3,
    bearingDeg: 90,
    capturedAt,
  };
}
