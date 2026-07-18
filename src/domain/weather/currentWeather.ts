import { z } from 'zod';
import { apiRequest } from '../../shared/api/apiClient';

const currentWeatherResponseSchema = z.object({
  data: z.object({
    weather: z.object({
      temperatureC: z.number().int().nullable(),
      sky: z.string().nullable(),
      precipType: z.string().nullable(),
    }).nullable(),
    wind: z.object({
      speedKmh: z.number().int().nonnegative().nullable(),
      directionText: z.string().nullable(),
      directionDeg: z.number().int().min(0).lt(360).nullable(),
    }).nullable(),
    stale: z.boolean(),
    forecastFallbackUsed: z.boolean(),
    freshnessStatus: z.enum(['FRESH_PROVIDER', 'FRESH_CACHE', 'STALE_LAST_SUCCESS', 'UNAVAILABLE']),
    staleReason: z.string().nullable(),
    observedAt: z.iso.datetime({ offset: true }).nullable(),
    cacheAgeSec: z.number().int().nonnegative(),
  }),
});

export type CurrentWeather = z.infer<typeof currentWeatherResponseSchema>['data'];

export async function fetchCurrentWeather(latitude: number, longitude: number): Promise<CurrentWeather> {
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
  const payload = await apiRequest<unknown>(`/api/v1/weather/current?${params.toString()}`);
  return currentWeatherResponseSchema.parse(payload).data;
}

export function weatherGridCoordinate(value: number): number {
  return Number(value.toFixed(2));
}
