import type { CurrentWeather } from '../../domain/weather/currentWeather';
import { presentRideWeather } from './weatherPresentation';

describe('ride weather presentation', () => {
  it('distinguishes loading from unavailable weather', () => {
    expect(presentRideWeather(null, true, null).title).toBe('날씨 확인 중');
    expect(presentRideWeather(unavailableWeather(), false, null).title).toBe('날씨 정보 없음');
  });

  it('shows stale observation age without blocking the ride', () => {
    const result = presentRideWeather({
      ...unavailableWeather(),
      weather: { temperatureC: 18, sky: '흐림', precipType: 'NONE' },
      wind: { speedKmh: 12, directionText: '서풍', directionDeg: 270 },
      stale: true,
      freshnessStatus: 'STALE_LAST_SUCCESS',
      observedAt: '2026-07-15T03:00:00Z',
      cacheAgeSec: 420,
    }, false, null);

    expect(result.title).toBe('18° 흐림');
    expect(result.meta).toContain('이전 관측 7분 전');
    expect(result.meta).toContain('주행은 계속됩니다');
  });
});

function unavailableWeather(): CurrentWeather {
  return {
    weather: null,
    wind: null,
    stale: false,
    forecastFallbackUsed: false,
    freshnessStatus: 'UNAVAILABLE',
    staleReason: 'provider unavailable',
    observedAt: null,
    cacheAgeSec: 0,
  };
}
