import {
  captureCurrentRideLocation,
  restartBackgroundRideLocation,
  startBackgroundRideLocation,
  stopBackgroundRideLocation,
} from './backgroundRideLocation';
import { loadRideDraft, updateRideDraft } from './localRideQueue';
import type { RideLifecycleDependencies } from './rideLifecycle';

export const RIDE_LIFECYCLE_DEPENDENCIES: RideLifecycleDependencies = {
  nowMs: Date.now,
  captureCurrentLocation: captureCurrentRideLocation,
  loadDraft: loadRideDraft,
  updateDraft: updateRideDraft,
  startCollection: startBackgroundRideLocation,
  stopCollection: stopBackgroundRideLocation,
};

export const RIDE_RECOVERY_DEPENDENCIES: RideLifecycleDependencies = {
  ...RIDE_LIFECYCLE_DEPENDENCIES,
  startCollection: restartBackgroundRideLocation,
};
