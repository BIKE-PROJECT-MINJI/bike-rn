import { appendRideSample, formatHudDistance, formatHudDuration, initialRideTrackingState, pauseRide, resumeRide } from './rideTracking';

describe('rideTracking', () => {
  it('accepted 위치 sample 사이의 거리를 증분 누적한다', () => {
    const first = appendRideSample(initialRideTrackingState(0), { latitude: 37, longitude: 127, recordedAtMs: 1000 });
    const second = appendRideSample(first, { latitude: 37.001, longitude: 127, recordedAtMs: 2000 });

    expect(second.trackedPoints).toHaveLength(2);
    expect(second.distanceMeters).toBeGreaterThan(100);
  });

  it('pause 상태에서는 sample을 무시한다', () => {
    const paused = pauseRide(initialRideTrackingState(0), 1000);
    const result = appendRideSample(paused, { latitude: 37, longitude: 127, recordedAtMs: 2000 });

    expect(result.trackedPoints).toHaveLength(0);
    expect(result.distanceMeters).toBe(0);
  });

  it('resume 후에는 다시 sample을 받는다', () => {
    const paused = pauseRide(initialRideTrackingState(0), 1000);
    const resumed = resumeRide(paused, 2000);

    expect(appendRideSample(resumed, { latitude: 37, longitude: 127, recordedAtMs: 3000 }).trackedPoints).toHaveLength(1);
  });

  it('HUD 거리와 시간을 한글 표시값으로 포맷한다', () => {
    expect(formatHudDistance(950)).toBe('950 m');
    expect(formatHudDistance(1250)).toBe('1.3 km');
    expect(formatHudDuration(65_000)).toBe('01:05');
  });
});
