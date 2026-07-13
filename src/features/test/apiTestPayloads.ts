import { DEFAULT_TEST_LAT, DEFAULT_TEST_LON } from './apiTestShared';

export function buildSampleRidePayload(nowMs = Date.now()): Record<string, unknown> {
  const startedAtMs = nowMs - 5 * 60 * 1000;
  return {
    clientRideId: `rn-test-${nowMs}`,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(nowMs).toISOString(),
    summary: { distanceM: 1320, durationSec: 300 },
    routePoints: [
      ridePoint(1, 37.5665, 126.978, startedAtMs),
      ridePoint(2, 37.5676, 126.9793, startedAtMs + 90_000),
      ridePoint(3, 37.5688, 126.981, startedAtMs + 180_000),
      ridePoint(4, 37.5697, 126.9824, nowMs),
    ],
  };
}

export function buildRideSummaryPayload(nowMs = Date.now()): Record<string, unknown> {
  const startedAtMs = nowMs - 5 * 60 * 1000;
  return {
    clientRideId: `rn-test-summary-${nowMs}`,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(nowMs).toISOString(),
    summary: { distanceM: 1320, durationSec: 300 },
  };
}

export function buildRidePolicyPayload(): Record<string, unknown> {
  return {
    phase: 'PRE_START',
    location: {
      lat: DEFAULT_TEST_LAT,
      lon: DEFAULT_TEST_LON,
      accuracyM: 15,
      capturedAt: new Date().toISOString(),
    },
  };
}

export function buildAiPlanPayload(routePrompt: string): Record<string, unknown> {
  return {
    lat: 37.4812,
    lon: 126.9527,
    destinationLat: 37.5512,
    destinationLon: 126.9882,
    destinationLabel: '남산',
    rideStyle: 'SCENERY_FIRST',
    elevationPreference: 'FLAT',
    textIntent: routePrompt,
  };
}

export function buildAiSessionPayload(routePrompt: string): Record<string, unknown> {
  return { ...buildAiPlanPayload(routePrompt), text: routePrompt };
}

export function buildImportGpxPayload(): Record<string, unknown> {
  return {
    title: 'RN 기능 테스트 GPX',
    description: 'RN 테스트 콘솔에서 넣은 최소 GPX',
    visibility: 'PRIVATE',
    gpx: [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="bike-rn-test">',
      '<trk><name>RN 기능 테스트 GPX</name><trkseg>',
      '<trkpt lat="37.5665" lon="126.9780"><ele>20</ele></trkpt>',
      '<trkpt lat="37.5676" lon="126.9793"><ele>21</ele></trkpt>',
      '</trkseg></trk></gpx>',
    ].join(''),
  };
}

export function buildCourseUpdatePayload(): Record<string, unknown> {
  return {
    name: 'RN 기능 테스트 코스 수정',
    description: 'RN 테스트 콘솔에서 수정한 코스',
    visibility: 'PRIVATE',
    routePoints: [
      { pointOrder: 1, latitude: 37.5665, longitude: 126.978 },
      { pointOrder: 2, latitude: 37.5676, longitude: 126.9793 },
    ],
  };
}

export function buildProfileUpdatePayload(): Record<string, unknown> {
  return {
    displayName: `RN테스트${Date.now().toString().slice(-4)}`,
    profileImageUrl: null,
  };
}

export function buildPreferencePayload(): Record<string, unknown> {
  return {
    scenic: true,
    bikeRoadPriority: 'HIGH',
    avoidDust: true,
    avoidUnsafeSurface: true,
  };
}

function ridePoint(pointOrder: number, latitude: number, longitude: number, capturedAtMs: number): Record<string, unknown> {
  return {
    pointOrder,
    latitude,
    longitude,
    capturedAt: new Date(capturedAtMs).toISOString(),
    accuracyM: 12,
    speedMps: 4.2,
  };
}
