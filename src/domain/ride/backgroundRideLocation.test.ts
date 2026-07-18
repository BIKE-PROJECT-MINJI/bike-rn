import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { appendRidePointsToQueue, loadAnyActiveRideDraftForBackgroundTask } from './localRideQueue';
import { createRideDraft, pauseRideDraft } from './rideQueueModel';
import {
  restartBackgroundRideLocation,
  startBackgroundRideLocation,
  stopBackgroundRideLocation,
} from './backgroundRideLocation';

jest.mock('expo-location', () => ({
  Accuracy: { High: 6 },
  getForegroundPermissionsAsync: jest.fn(),
  getBackgroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  isBackgroundLocationAvailableAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  isTaskDefined: jest.fn(() => false),
  defineTask: jest.fn(),
}));

jest.mock('./localRideQueue', () => ({
  appendRidePointsToQueue: jest.fn(),
  loadAnyActiveRideDraftForBackgroundTask: jest.fn(() => null),
  updateRideDraft: jest.fn(),
}));

const registeredBackgroundTask = jest.mocked(TaskManager.defineTask).mock.calls[0]?.[1];

describe('background ride location', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
    jest.mocked(Location.getBackgroundPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(true);
    jest.mocked(Location.isBackgroundLocationAvailableAsync).mockResolvedValue(true);
    jest.mocked(Location.hasStartedLocationUpdatesAsync).mockResolvedValue(true);
    jest.mocked(Location.startLocationUpdatesAsync).mockResolvedValue(undefined);
    jest.mocked(Location.stopLocationUpdatesAsync).mockResolvedValue(undefined);
    await stopBackgroundRideLocation();
    jest.clearAllMocks();
  });

  it('re-registers an existing task so Android restarts a stopped foreground service', async () => {
    await startBackgroundRideLocation();

    expect(Location.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  });

  it('does not claim a restart when device location services are disabled', async () => {
    jest.mocked(Location.hasServicesEnabledAsync).mockResolvedValue(false);

    await expect(startBackgroundRideLocation()).rejects.toThrow(
      '기기의 위치 서비스를 켠 뒤 주행 기록을 다시 연결해 주세요.',
    );
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('does not restart collection after location permission was revoked', async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);

    await expect(startBackgroundRideLocation()).rejects.toThrow(
      '주행 기록을 계속하려면 정확한 위치 권한이 필요합니다.',
    );
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('refreshes a stale task without unregistering the native foreground service', async () => {
    const events: string[] = [];
    jest.mocked(Location.stopLocationUpdatesAsync).mockImplementation(async () => {
      events.push('stop');
    });
    jest.mocked(Location.startLocationUpdatesAsync).mockImplementation(async () => {
      events.push('start');
    });

    await restartBackgroundRideLocation();

    expect(events).toEqual(['start']);
  });

  it('does not create another native binding after collection started in this runtime', async () => {
    await restartBackgroundRideLocation();
    jest.clearAllMocks();

    await startBackgroundRideLocation();

    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('does not force another stop-start cycle on repeated foreground reconciliation', async () => {
    await restartBackgroundRideLocation();
    jest.clearAllMocks();

    await restartBackgroundRideLocation();

    expect(Location.stopLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('rejects approximate-only Android location permission', async () => {
    jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
      status: 'granted',
      android: { accuracy: 'coarse' },
    } as never);

    await expect(startBackgroundRideLocation()).rejects.toThrow(
      '주행 기록을 계속하려면 정확한 위치 권한이 필요합니다.',
    );
    expect(Location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('ignores an in-flight location callback after the ride was paused', async () => {
    // Given
    const recording = createRideDraft('ride-paused-before-callback', 1_700_000_000_000, undefined, 11);
    jest.mocked(loadAnyActiveRideDraftForBackgroundTask).mockReturnValue(
      pauseRideDraft(recording, 1_700_000_001_000),
    );
    if (registeredBackgroundTask === undefined) {
      throw new Error('백그라운드 위치 task가 등록되지 않았습니다.');
    }

    // When
    await registeredBackgroundTask({
      data: { locations: [] },
      error: null,
      executionInfo: { eventId: 'event-after-pause', taskName: 'gaja-background-ride-location-v1' },
    });

    // Then
    expect(appendRidePointsToQueue).not.toHaveBeenCalled();
  });
});
