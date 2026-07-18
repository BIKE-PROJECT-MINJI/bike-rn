import { classifyRidePointLink } from './rideDistanceQuality';

const basePoint = {
  latitude: 37.5665,
  longitude: 126.978,
  capturedAtIso: '2026-07-16T00:00:00.000Z',
  accuracyM: 5,
  speedMps: 4,
  bearingDeg: 90,
  altitudeM: 12,
} as const;

describe('ride distance quality', () => {
  it('accepts an ordinary adjacent point', () => {
    const result = classifyRidePointLink(basePoint, {
      ...basePoint,
      latitude: 37.5666,
      capturedAtIso: '2026-07-16T00:00:10.000Z',
    }, Date.parse(basePoint.capturedAtIso));

    expect(result.kind).toBe('ACCEPTED');
    expect(result.kind === 'ACCEPTED' ? result.distanceMeters : 0).toBeGreaterThan(0);
  });

  it.each([
    ['LOW_ACCURACY', { accuracyM: 50.1 }],
    ['TIME_GAP', { capturedAtIso: '2026-07-16T00:02:00.001Z' }],
    ['NON_MONOTONIC_TIME', { capturedAtIso: basePoint.capturedAtIso }],
    ['IMPLAUSIBLE_SPEED', { latitude: 37.57, capturedAtIso: '2026-07-16T00:00:01.000Z' }],
  ])('breaks the provisional distance link for %s', (reason, override) => {
    const result = classifyRidePointLink(
      basePoint,
      { ...basePoint, ...override },
      Date.parse(basePoint.capturedAtIso),
    );

    expect(result).toEqual({ kind: 'SEGMENT_BREAK', reason });
  });

  it('does not connect a point captured before the current active segment', () => {
    const result = classifyRidePointLink(
      basePoint,
      { ...basePoint, latitude: 37.5666, capturedAtIso: '2026-07-16T00:00:20.000Z' },
      Date.parse('2026-07-16T00:00:15.000Z'),
    );

    expect(result).toEqual({ kind: 'SEGMENT_BREAK', reason: 'ACTIVE_SEGMENT_BOUNDARY' });
  });

  it('keeps inclusive accuracy, time-gap, and implied-speed boundaries', () => {
    const accuracyBoundary = classifyRidePointLink(
      { ...basePoint, accuracyM: 50 },
      { ...basePoint, accuracyM: 50, latitude: 37.5666, capturedAtIso: '2026-07-16T00:02:00.000Z' },
      Date.parse(basePoint.capturedAtIso),
    );
    const speedBoundary = classifyRidePointLink(
      basePoint,
      { ...basePoint, latitude: 37.56672483, capturedAtIso: '2026-07-16T00:00:01.000Z' },
      Date.parse(basePoint.capturedAtIso),
    );

    expect(accuracyBoundary.kind).toBe('ACCEPTED');
    expect(speedBoundary.kind).toBe('ACCEPTED');
  });
});
