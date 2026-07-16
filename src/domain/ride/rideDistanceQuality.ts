const MAX_ACCURACY_METERS = 50;
const MAX_POINT_GAP_MS = 120_000;
const MAX_IMPLIED_SPEED_MPS = 25;
const EARTH_RADIUS_METERS = 6_371_000;

type RideDistancePoint = {
  readonly latitude: number;
  readonly longitude: number;
  readonly capturedAtIso: string;
  readonly accuracyM: number | null;
};

export type RidePointLinkDecision =
  | { readonly kind: 'ACCEPTED'; readonly distanceMeters: number }
  | {
      readonly kind: 'SEGMENT_BREAK';
      readonly reason:
        | 'ACTIVE_SEGMENT_BOUNDARY'
        | 'IMPLAUSIBLE_SPEED'
        | 'LOW_ACCURACY'
        | 'NON_MONOTONIC_TIME'
        | 'TIME_GAP';
    };

export function classifyRidePointLink(
  previous: RideDistancePoint,
  current: RideDistancePoint,
  activeSegmentStartedAtMs: number,
): RidePointLinkDecision {
  if (!hasUsableAccuracy(previous) || !hasUsableAccuracy(current)) {
    return { kind: 'SEGMENT_BREAK', reason: 'LOW_ACCURACY' };
  }
  const previousAtMs = Date.parse(previous.capturedAtIso);
  const currentAtMs = Date.parse(current.capturedAtIso);
  const elapsedMs = currentAtMs - previousAtMs;
  if (elapsedMs <= 0) {
    return { kind: 'SEGMENT_BREAK', reason: 'NON_MONOTONIC_TIME' };
  }
  if (previousAtMs < activeSegmentStartedAtMs) {
    return { kind: 'SEGMENT_BREAK', reason: 'ACTIVE_SEGMENT_BOUNDARY' };
  }
  if (elapsedMs > MAX_POINT_GAP_MS) {
    return { kind: 'SEGMENT_BREAK', reason: 'TIME_GAP' };
  }
  const distanceMeters = distanceBetweenMeters(previous, current);
  if (distanceMeters / (elapsedMs / 1_000) > MAX_IMPLIED_SPEED_MPS) {
    return { kind: 'SEGMENT_BREAK', reason: 'IMPLAUSIBLE_SPEED' };
  }
  return { kind: 'ACCEPTED', distanceMeters };
}

function hasUsableAccuracy(point: RideDistancePoint): boolean {
  return point.accuracyM !== null && point.accuracyM <= MAX_ACCURACY_METERS;
}

function distanceBetweenMeters(start: RideDistancePoint, end: RideDistancePoint): number {
  const latitudeDelta = degreesToRadians(end.latitude - start.latitude);
  const longitudeDelta = degreesToRadians(end.longitude - start.longitude);
  const startLatitudeRadians = degreesToRadians(start.latitude);
  const endLatitudeRadians = degreesToRadians(end.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitudeRadians) *
      Math.cos(endLatitudeRadians) *
      Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
