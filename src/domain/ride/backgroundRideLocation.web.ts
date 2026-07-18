export async function requestRideLocationPermissions(): Promise<'FOREGROUND_DENIED'> {
  return 'FOREGROUND_DENIED';
}

export async function startBackgroundRideLocation(): Promise<void> {
  throw new WebRideRecordingUnavailableError();
}

export async function stopBackgroundRideLocation(): Promise<void> {
  return undefined;
}

export async function restartBackgroundRideLocation(): Promise<void> {
  return startBackgroundRideLocation();
}

class WebRideRecordingUnavailableError extends Error {
  constructor() {
    super('주행 기록은 Android 실기기 빌드에서 사용해 주세요.');
    this.name = 'WebRideRecordingUnavailableError';
  }
}
