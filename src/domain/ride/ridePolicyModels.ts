import type { RideRecordPoint } from './rideTracking';

export type RidePolicyPhase = 'PRE_START' | 'ACTIVE';

export type RidePolicyEvaluationRequest = {
  readonly phase: RidePolicyPhase;
  readonly location: RidePolicyLocation;
  readonly trace: readonly RidePolicyLocation[];
};

export type RidePolicyLocation = {
  readonly lat: number;
  readonly lon: number;
  readonly accuracyM: number;
  readonly capturedAt: string;
};

export type RidePolicyEvaluationUiModel = {
  readonly phase: string;
  readonly overallState: string;
  readonly defaultMessage: string;
  readonly startGateStatus: string;
  readonly offRouteStatus: string;
  readonly offRouteDistanceM: number | null;
  readonly completionStatus: string;
  readonly completionCoveragePercent: number | null;
  readonly progressPercent: number | null;
  readonly remainingDistanceM: number | null;
  readonly distanceAlongRouteM: number | null;
};

export function toRidePolicyLocation(point: RideRecordPoint, accuracyM: number): RidePolicyLocation {
  return {
    lat: point.latitude,
    lon: point.longitude,
    accuracyM,
    capturedAt: new Date(point.recordedAtMs).toISOString(),
  };
}
