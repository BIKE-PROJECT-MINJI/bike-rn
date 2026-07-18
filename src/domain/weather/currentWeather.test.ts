import { weatherGridCoordinate } from './currentWeather';

describe('current weather grid', () => {
  it('uses the same 0.01 degree grid as the backend cache', () => {
    expect(weatherGridCoordinate(37.5249)).toBe(37.52);
    expect(weatherGridCoordinate(37.5251)).toBe(37.53);
  });
});
