export type RideTrackingStatus = 'ACTIVE' | 'PAUSED';

export type RideLocationSample = {
  latitude: number;
  longitude: number;
  recordedAtMs: number;
};

export type RideRecordPoint = {
  pointOrder: number;
  latitude: number;
  longitude: number;
  recordedAtMs: number;
};

export type RideTrackingState = {
  status: RideTrackingStatus;
  startedAtMs: number;
  activeSegmentStartedAtMs: number;
  accumulatedActiveMs: number;
  distanceMeters: number;
  lastAcceptedSample: RideLocationSample | null;
  trackedPoints: RideRecordPoint[];
};

export function initialRideTrackingState(startedAtMs: number): RideTrackingState {
  return {
    status: 'ACTIVE',
    startedAtMs,
    activeSegmentStartedAtMs: startedAtMs,
    accumulatedActiveMs: 0,
    distanceMeters: 0,
    lastAcceptedSample: null,
    trackedPoints: [],
  };
}

export function appendRideSample(state: RideTrackingState, sample: RideLocationSample): RideTrackingState {
  if (state.status !== 'ACTIVE') {
    return state;
  }

  const distanceDelta = state.lastAcceptedSample
    ? distanceBetweenMeters(state.lastAcceptedSample.latitude, state.lastAcceptedSample.longitude, sample.latitude, sample.longitude)
    : 0;

  return {
    ...state,
    distanceMeters: state.distanceMeters + distanceDelta,
    lastAcceptedSample: sample,
    trackedPoints: [
      ...state.trackedPoints,
      {
        pointOrder: state.trackedPoints.length + 1,
        latitude: sample.latitude,
        longitude: sample.longitude,
        recordedAtMs: sample.recordedAtMs,
      },
    ],
  };
}

export function pauseRide(state: RideTrackingState, nowMs: number): RideTrackingState {
  if (state.status === 'PAUSED') {
    return state;
  }
  return {
    ...state,
    status: 'PAUSED',
    accumulatedActiveMs: state.accumulatedActiveMs + Math.max(0, nowMs - state.activeSegmentStartedAtMs),
    lastAcceptedSample: null,
  };
}

export function resumeRide(state: RideTrackingState, nowMs: number): RideTrackingState {
  if (state.status === 'ACTIVE') {
    return state;
  }
  return {
    ...state,
    status: 'ACTIVE',
    activeSegmentStartedAtMs: nowMs,
    lastAcceptedSample: null,
  };
}

export function activeElapsedMs(state: RideTrackingState, nowMs: number): number {
  const activeSegmentMs = state.status === 'ACTIVE' ? Math.max(0, nowMs - state.activeSegmentStartedAtMs) : 0;
  return state.accumulatedActiveMs + activeSegmentMs;
}

export function formatHudDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

export function formatHudDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function distanceBetweenMeters(startLatitude: number, startLongitude: number, endLatitude: number, endLongitude: number): number {
  const latitudeDelta = degreesToRadians(endLatitude - startLatitude);
  const longitudeDelta = degreesToRadians(endLongitude - startLongitude);
  const startLatitudeRadians = degreesToRadians(startLatitude);
  const endLatitudeRadians = degreesToRadians(endLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitudeRadians) * Math.cos(endLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
