import { useQuery } from '@tanstack/react-query';
import { fetchCurrentWeather, weatherGridCoordinate } from '../../domain/weather/currentWeather';
import type { RideDraft } from '../../domain/ride/rideQueueModel';
import { latestRidePoint } from './rideHudModel';

const WEATHER_REFRESH_MS = 5 * 60 * 1_000;

export function useRideWeather(draft: RideDraft | null) {
  const point = latestRidePoint(draft);
  const latitude = point === null ? null : weatherGridCoordinate(point.latitude);
  const longitude = point === null ? null : weatherGridCoordinate(point.longitude);
  return useQuery({
    queryKey: ['ride-weather', latitude, longitude],
    queryFn: () => {
      if (latitude === null || longitude === null) {
        throw new MissingWeatherLocationError();
      }
      return fetchCurrentWeather(latitude, longitude);
    },
    enabled: latitude !== null && longitude !== null,
    staleTime: WEATHER_REFRESH_MS,
    refetchInterval: WEATHER_REFRESH_MS,
    retry: 0,
  });
}

class MissingWeatherLocationError extends Error {
  constructor() {
    super('날씨를 조회할 위치가 없습니다.');
    this.name = 'MissingWeatherLocationError';
  }
}
