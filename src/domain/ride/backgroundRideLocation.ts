import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { appendRidePointsToQueue, loadActiveRideDraft, updateRideDraft } from './localRideQueue';
import { markRideLocationError, type RidePointInput } from './rideQueueModel';

export const RIDE_LOCATION_TASK_NAME = 'gaja-background-ride-location-v1';
let collectionStartedThisRuntime = false;

type RideLocationTaskData = {
  readonly locations: readonly Location.LocationObject[];
};

if (!TaskManager.isTaskDefined(RIDE_LOCATION_TASK_NAME)) {
  TaskManager.defineTask<RideLocationTaskData>(RIDE_LOCATION_TASK_NAME, async ({ data, error, executionInfo }) => {
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
    await appendRidePointsToQueue(draft.clientRideId, points, executionInfo.eventId);
  });
}

export async function requestRideLocationPermissions(): Promise<'GRANTED' | 'FOREGROUND_DENIED' | 'BACKGROUND_DENIED'> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!hasPreciseForegroundPermission(foreground)) {
    return 'FOREGROUND_DENIED';
  }
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.status === 'granted' ? 'GRANTED' : 'BACKGROUND_DENIED';
}

export async function startBackgroundRideLocation(): Promise<void> {
  const [foreground, background, servicesEnabled, available] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
    Location.isBackgroundLocationAvailableAsync(),
  ]);
  if (!hasPreciseForegroundPermission(foreground)) {
    collectionStartedThisRuntime = false;
    throw new RideLocationPermissionError('주행 기록을 계속하려면 정확한 위치 권한이 필요합니다.');
  }
  if (background.status !== 'granted') {
    collectionStartedThisRuntime = false;
    throw new RideLocationPermissionError('화면 잠금 중 기록을 위해 위치 권한을 항상 허용으로 바꿔 주세요.');
  }
  if (!servicesEnabled) {
    collectionStartedThisRuntime = false;
    throw new RideLocationServicesDisabledError();
  }
  if (!available) {
    collectionStartedThisRuntime = false;
    throw new BackgroundLocationUnavailableError();
  }
  if (collectionStartedThisRuntime) {
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(RIDE_LOCATION_TASK_NAME);
    if (alreadyStarted) {
      return;
    }
    collectionStartedThisRuntime = false;
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
  collectionStartedThisRuntime = true;
}

export async function restartBackgroundRideLocation(): Promise<void> {
  if (collectionStartedThisRuntime) {
    await startBackgroundRideLocation();
    return;
  }
  collectionStartedThisRuntime = false;
  await startBackgroundRideLocation();
}

export async function captureCurrentRideLocation(clientRideId: string): Promise<void> {
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  await appendRidePointsToQueue(clientRideId, [toRidePointInput(location)]);
}

export async function stopBackgroundRideLocation(): Promise<void> {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(RIDE_LOCATION_TASK_NAME);
    if (started) {
      await Location.stopLocationUpdatesAsync(RIDE_LOCATION_TASK_NAME);
    }
  } finally {
    collectionStartedThisRuntime = false;
  }
}

class BackgroundLocationUnavailableError extends Error {
  constructor() {
    super('이 빌드에서는 백그라운드 위치 수집을 사용할 수 없습니다. 개발 빌드를 설치해 주세요.');
    this.name = 'BackgroundLocationUnavailableError';
  }
}

class RideLocationPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RideLocationPermissionError';
  }
}

class RideLocationServicesDisabledError extends Error {
  constructor() {
    super('기기의 위치 서비스를 켠 뒤 주행 기록을 다시 연결해 주세요.');
    this.name = 'RideLocationServicesDisabledError';
  }
}

function normalizeNonNegative(value: number | null): number | null {
  return value !== null && value >= 0 ? value : null;
}

function normalizeBearing(value: number | null): number | null {
  return value !== null && value >= 0 && value < 360 ? value : null;
}

function hasPreciseForegroundPermission(permission: Location.LocationPermissionResponse): boolean {
  if (permission.status !== 'granted') {
    return false;
  }
  return permission.android?.accuracy !== 'coarse' && permission.android?.accuracy !== 'none';
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
