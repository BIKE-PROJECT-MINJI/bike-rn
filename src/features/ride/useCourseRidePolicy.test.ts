import { appendRidePoints, createRideDraft } from '../../domain/ride/rideQueueModel';
import { buildActiveRidePolicyRequest, samplePolicyTrace, shouldRequestRidePolicy } from './useCourseRidePolicy';

const BASE_POINT = {
  latitude: 37.5,
  longitude: 127,
  capturedAtIso: '2026-07-15T00:00:00.000Z',
  accuracyM: 8,
  speedMps: 4,
  bearingDeg: 90,
  altitudeM: 10,
};

describe('course ride policy request', () => {
  it('allows a new request only after three seconds and never while one is pending', () => {
    expect(shouldRequestRidePolicy(null, 1_000, false)).toBe(true);
    expect(shouldRequestRidePolicy(1_000, 3_999, false)).toBe(false);
    expect(shouldRequestRidePolicy(1_000, 4_000, false)).toBe(true);
    expect(shouldRequestRidePolicy(1_000, 4_000, true)).toBe(false);
  });

  it('does not guess accuracy when the latest GPS point has no accuracy', () => {
    const draft = appendRidePoints(createRideDraft('ride-1', Date.parse(BASE_POINT.capturedAtIso)), [
      { ...BASE_POINT, accuracyM: null },
    ]);

    expect(buildActiveRidePolicyRequest(draft)).toBeNull();
  });

  it('keeps the latest point separate and sends an ordered active trace', () => {
    const draft = appendRidePoints(createRideDraft('ride-1', Date.parse(BASE_POINT.capturedAtIso)), [
      BASE_POINT,
      { ...BASE_POINT, longitude: 127.001, capturedAtIso: '2026-07-15T00:00:03.000Z' },
    ]);

    expect(buildActiveRidePolicyRequest(draft)).toEqual({
      phase: 'ACTIVE',
      location: { lat: 37.5, lon: 127.001, accuracyM: 8, capturedAt: '2026-07-15T00:00:03.000Z' },
      trace: [{ lat: 37.5, lon: 127, accuracyM: 8, capturedAt: '2026-07-15T00:00:00.000Z' }],
    });
  });

  it('samples the whole trace with first and last points preserved', () => {
    const points = appendRidePoints(
      createRideDraft('ride-1', Date.parse(BASE_POINT.capturedAtIso)),
      Array.from({ length: 10 }, (_, index) => ({
        ...BASE_POINT,
        longitude: 127 + index / 10_000,
        capturedAtIso: new Date(Date.parse(BASE_POINT.capturedAtIso) + index * 3_000).toISOString(),
      })),
    ).routePoints;

    const sampled = samplePolicyTrace(points, 4);

    expect(sampled).toHaveLength(4);
    expect(sampled[0]?.pointOrder).toBe(1);
    expect(sampled.at(-1)?.pointOrder).toBe(10);
  });

  it('caps a long valid trace to 599 points before the separate current location', () => {
    const points = appendRidePoints(
      createRideDraft('ride-long', Date.parse(BASE_POINT.capturedAtIso)),
      Array.from({ length: 1_001 }, (_, index) => ({
        ...BASE_POINT,
        longitude: 127 + index / 1_000_000,
        capturedAtIso: new Date(Date.parse(BASE_POINT.capturedAtIso) + index * 3_000).toISOString(),
      })),
    ).routePoints;

    const request = buildActiveRidePolicyRequest({
      ...createRideDraft('ride-long', Date.parse(BASE_POINT.capturedAtIso)),
      routePoints: points,
    });

    expect(request?.trace).toHaveLength(599);
    expect(request?.trace[0]?.capturedAt).toBe(points[0]?.capturedAtIso);
    expect(request?.trace.at(-1)?.capturedAt).toBe(points.at(-2)?.capturedAtIso);
    expect(request?.location.capturedAt).toBe(points.at(-1)?.capturedAtIso);
  });
});
