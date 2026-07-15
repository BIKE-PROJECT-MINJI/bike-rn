import type { RideDraft, RidePoint } from '../../domain/ride/rideQueueModel';

const MIN_HEADING_SPEED_MPS = 1;
const MAX_HEADING_ACCURACY_M = 50;
const MAX_HEADING_AGE_MS = 15_000;

export function latestRidePoint(draft: RideDraft | null): RidePoint | null {
  return draft?.routePoints.at(-1) ?? null;
}

export function rideSpeedKmh(draft: RideDraft | null): number {
  const speedMps = latestRidePoint(draft)?.speedMps;
  return speedMps === null || speedMps === undefined ? 0 : speedMps * 3.6;
}

export function displayRideHeading(draft: RideDraft | null, nowMs: number): number | null {
  const point = latestRidePoint(draft);
  if (
    point === null ||
    point.bearingDeg === null ||
    point.speedMps === null ||
    point.speedMps < MIN_HEADING_SPEED_MPS ||
    point.accuracyM === null ||
    point.accuracyM > MAX_HEADING_ACCURACY_M
  ) {
    return null;
  }
  const capturedAtMs = Date.parse(point.capturedAtIso);
  if (!Number.isFinite(capturedAtMs) || nowMs - capturedAtMs > MAX_HEADING_AGE_MS) {
    return null;
  }
  return point.bearingDeg;
}
