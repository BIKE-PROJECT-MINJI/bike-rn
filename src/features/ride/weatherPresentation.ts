import type { CurrentWeather } from '../../domain/weather/currentWeather';

export type RideWeatherPresentation = {
  readonly title: string;
  readonly meta: string;
};

export function presentRideWeather(
  weather: CurrentWeather | null,
  loading: boolean,
  error: Error | null,
): RideWeatherPresentation {
  if (loading && weather === null) {
    return { title: '날씨 확인 중', meta: '날씨 없이도 주행은 계속됩니다' };
  }
  if (error !== null || weather === null || weather.freshnessStatus === 'UNAVAILABLE') {
    return { title: '날씨 정보 없음', meta: '날씨 없이도 주행은 계속됩니다' };
  }
  const temperature = weather.weather?.temperatureC === null || weather.weather?.temperatureC === undefined
    ? '--'
    : `${weather.weather.temperatureC}°`;
  const sky = weather.weather?.sky ?? '날씨 미확인';
  const direction = weather.wind?.directionText
    ?? (weather.wind?.directionDeg === null || weather.wind?.directionDeg === undefined
      ? '풍향 미확인'
      : `${weather.wind.directionDeg}°`);
  const speed = weather.wind?.speedKmh === null || weather.wind?.speedKmh === undefined
    ? '풍속 미확인'
    : `${weather.wind.speedKmh}km/h`;
  const age = weather.stale || weather.freshnessStatus === 'STALE_LAST_SUCCESS'
    ? ` · 이전 관측 ${Math.max(1, Math.ceil(weather.cacheAgeSec / 60))}분 전 · 주행은 계속됩니다`
    : '';
  return { title: `${temperature} ${sky}`, meta: `${direction} ${speed}${age}` };
}
