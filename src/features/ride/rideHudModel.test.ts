import { appendRidePoint, createRideDraft, pauseRideDraft, type RidePointInput } from '../../domain/ride/rideQueueModel';
import { displayRideHeading, rideSpeedKmh } from './rideHudModel';

const NOW_MS = 1_700_000_010_000;

describe('ride HUD model', () => {
  it('속도는 마지막 GPS sample을 km/h로 변환한다', () => {
    const draft = appendRidePoint(createRideDraft('ride-1', NOW_MS - 10_000), point({ speedMps: 4.25 }));

    expect(rideSpeedKmh(draft)).toBeCloseTo(15.3, 5);
  });

  it('일시정지 중에는 마지막 GPS sample과 무관하게 속도를 0으로 표시한다', () => {
    const recording = appendRidePoint(createRideDraft('ride-1', NOW_MS - 10_000), point({ speedMps: 4.25 }));
    const paused = pauseRideDraft(recording, NOW_MS);

    expect(rideSpeedKmh(paused)).toBe(0);
  });

  it.each([
    ['저속', { speedMps: 0.9 }],
    ['낮은 정확도', { accuracyM: 50.1 }],
    ['오래된 위치', { capturedAtIso: new Date(NOW_MS - 15_001).toISOString() }],
    ['bearing 없음', { bearingDeg: null }],
  ] as const)('%s에서는 GPS 이동 방향을 숨긴다', (_label, override) => {
    const draft = appendRidePoint(createRideDraft('ride-1', NOW_MS - 10_000), point(override));

    expect(displayRideHeading(draft, NOW_MS)).toBeNull();
  });

  it('fresh하고 정확한 이동 sample만 GPS 이동 방향을 표시한다', () => {
    const draft = appendRidePoint(createRideDraft('ride-1', NOW_MS - 10_000), point());

    expect(displayRideHeading(draft, NOW_MS)).toBe(128);
  });
});

function point(override: Partial<RidePointInput> = {}): RidePointInput {
  return {
    latitude: 37.5665,
    longitude: 126.978,
    capturedAtIso: new Date(NOW_MS - 1_000).toISOString(),
    accuracyM: 8,
    speedMps: 4,
    bearingDeg: 128,
    altitudeM: 30,
    ...override,
  };
}
