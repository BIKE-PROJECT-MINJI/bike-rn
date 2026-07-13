import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { appendRidePointsToQueue, loadActiveRideDraft, updateRideDraft } from './localRideQueue';
import { markRideLocationError, type RidePointInput } from './rideQueueModel';

export const RIDE_LOCATION_TASK_NAME = 'gaja-background-ride-location-v1';

type RideLocationTaskData = {
  readonly locations: readonly Location.LocationObject[];
};

if (!TaskManager.isTaskDefined(RIDE_LOCATION_TASK_NAME)) {
  TaskManager.defineTask<RideLocationTaskData>(RIDE_LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error !== null) {
      const failedDraft = loadActiveRideDraft();
      if (failedDraft !== null) {
        await updateRideDraft(failedDraft.clientRideId, (draft) => markRideLocationError(draft, String(error.code)));
      }
      return;
    }
    const draft = loadActiveRideDraft();
    if (draft === null) {
      return;
    }
    const points: RidePointInput[] = data.locations.map(toRidePointInput);
    await appendRidePointsToQueue(draft.clientRideId, points);
  });
}

export async function requestRideLocationPermissions(): Promise<'GRANTED' | 'FOREGROUND_DENIED' | 'BACKGROUND_DENIED'> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    return 'FOREGROUND_DENIED';
  }
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === 'granted' ? 'GRANTED' : 'BACKGROUND_DENIED';
}

export async function startBackgroundRideLocation(): Promise<void> {
  const available = await Location.isBackgroundLocationAvailableAsync();
  if (!available) {
    throw new BackgroundLocationUnavailableError();
  }
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(RIDE_LOCATION_TASK_NAME);
  if (alreadyStarted) {
    return;
  }
  await Location.startLocationUpdatesAsync(RIDE_LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 5,
    timeInterval: 2_000,
    deferredUpdatesDistance: 10,
    deferredUpdatesInterval: 5_000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'GAJA 주행 기록 중',
      notificationBody: '화면이 잠겨도 이동 경로를 안전하게 저장하고 있습니다.',
      notificationColor: '#0A2F22',
      killServiceOnDestroy: false,
    },
  });
}

export async function captureCurrentRideLocation(clientRideId: string): Promise<void> {
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  await appendRidePointsToQueue(clientRideId, [toRidePointInput(location)]);
}

export async function stopBackgroundRideLocation(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(RIDE_LOCATION_TASK_NAME);
  if (started) {
    await Location.stopLocationUpdatesAsync(RIDE_LOCATION_TASK_NAME);
  }
}

class BackgroundLocationUnavailableError extends Error {
  constructor() {
    super('이 빌드에서는 백그라운드 위치 수집을 사용할 수 없습니다. 개발 빌드를 설치해 주세요.');
    this.name = 'BackgroundLocationUnavailableError';
  }
}

function normalizeNonNegative(value: number | null): number | null {
  return value !== null && value >= 0 ? value : null;
}

function normalizeBearing(value: number | null): number | null {
  return value !== null && value >= 0 && value < 360 ? value : null;
}

function toRidePointInput(location: Location.LocationObject): RidePointInput {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    capturedAtIso: new Date(location.timestamp).toISOString(),
    accuracyM: location.coords.accuracy,
    speedMps: normalizeNonNegative(location.coords.speed),
    bearingDeg: normalizeBearing(location.coords.heading),
    altitudeM: location.coords.altitude,
  };
}
