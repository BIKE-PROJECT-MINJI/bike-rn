import { loadAnyActiveRideDraftForBackgroundTask } from './localRideQueue';
import { pauseOrResumeRide } from './rideLifecycle';
import { RIDE_LIFECYCLE_DEPENDENCIES } from './rideSessionDependencies';

export async function pauseRecordingRideForAuthTransition(
  nextUserId: number | null,
  expectedCurrentUserId?: number | null,
): Promise<void> {
  const active = loadAnyActiveRideDraftForBackgroundTask();
  if (
    active?.status !== 'RECORDING' ||
    (expectedCurrentUserId !== undefined && active.ownerUserId !== expectedCurrentUserId) ||
    active.ownerUserId === nextUserId
  ) {
    return;
  }
  await pauseOrResumeRide(active, RIDE_LIFECYCLE_DEPENDENCIES);
}
