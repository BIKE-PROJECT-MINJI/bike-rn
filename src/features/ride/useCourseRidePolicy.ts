import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { CourseRoutePointUiModel } from '../../domain/course/courseModels';
import { fetchCourseRoutePoints } from '../../domain/course/courseService';
import type { RideDraft, RidePoint } from '../../domain/ride/rideQueueModel';
import type { RidePolicyEvaluationRequest, RidePolicyEvaluationUiModel } from '../../domain/ride/ridePolicyModels';
import { evaluateRidePolicy } from '../../domain/ride/ridePolicyService';

const POLICY_INTERVAL_MS = 3_000;
const MAX_POLICY_TRACE_POINTS = 599;

export type CourseRidePolicyState = {
  readonly routePoints: readonly CourseRoutePointUiModel[];
  readonly routeLoading: boolean;
  readonly routeError: Error | null;
  readonly policy: RidePolicyEvaluationUiModel | null;
  readonly policyLoading: boolean;
  readonly policyError: Error | null;
  readonly policyStale: boolean;
};

export function useCourseRidePolicy(courseId: number | null, draft: RideDraft | null, nowMs: number): CourseRidePolicyState {
  const routeQuery = useQuery({
    queryKey: ['course-route-points', courseId],
    queryFn: () => fetchCourseRoutePoints(courseId ?? 0),
    enabled: courseId !== null,
  });
  const policyMutation = useMutation({
    mutationFn: (request: RidePolicyEvaluationRequest) => evaluateRidePolicy(courseId ?? 0, request),
  });
  const lastRequestedAtMs = useRef<number | null>(null);
  const latestPoint = draft?.routePoints.at(-1) ?? null;
  const latestCapturedAtMs = latestPoint === null ? Number.NaN : Date.parse(latestPoint.capturedAtIso);
  const policyStale = courseId !== null && (
    !Number.isFinite(latestCapturedAtMs) || nowMs - latestCapturedAtMs > 15_000
  );

  useEffect(() => {
    lastRequestedAtMs.current = null;
  }, [courseId]);

  useEffect(() => {
    if (courseId === null || draft === null || latestPoint === null) {
      return;
    }
    const request = buildActiveRidePolicyRequest(draft);
    if (request === null) {
      return;
    }
    const capturedAtMs = Date.parse(request.location.capturedAt);
    const previousAtMs = lastRequestedAtMs.current;
    if (!shouldRequestRidePolicy(previousAtMs, capturedAtMs, policyMutation.isPending)) {
      return;
    }
    lastRequestedAtMs.current = capturedAtMs;
    policyMutation.mutate(request);
  }, [courseId, draft, latestPoint, policyMutation.isPending, policyMutation.mutate]);

  return {
    routePoints: routeQuery.data ?? [],
    routeLoading: routeQuery.isPending,
    routeError: routeQuery.error,
    policy: policyMutation.data ?? null,
    policyLoading: policyMutation.isPending,
    policyError: policyMutation.error,
    policyStale,
  };
}

export function shouldRequestRidePolicy(
  previousCapturedAtMs: number | null,
  currentCapturedAtMs: number,
  pending: boolean,
): boolean {
  return !pending && (previousCapturedAtMs === null || currentCapturedAtMs - previousCapturedAtMs >= POLICY_INTERVAL_MS);
}

export function buildActiveRidePolicyRequest(draft: RideDraft): RidePolicyEvaluationRequest | null {
  const latest = draft.routePoints.at(-1);
  const latestAccuracyM = latest?.accuracyM ?? null;
  if (latest === undefined || latestAccuracyM === null) {
    return null;
  }
  const validTrace = draft.routePoints.slice(0, -1).filter(hasAccuracy);
  const trace = samplePolicyTrace(validTrace, MAX_POLICY_TRACE_POINTS)
    .map((point) => toPolicyLocation(point, point.accuracyM));
  return { phase: 'ACTIVE', location: toPolicyLocation(latest, latestAccuracyM), trace };
}

export function samplePolicyTrace<T extends RidePoint>(points: readonly T[], limit: number): readonly T[] {
  if (limit < 1 || points.length === 0) {
    return [];
  }
  if (points.length <= limit) {
    return points;
  }
  if (limit === 1) {
    return [points[0]];
  }
  const lastIndex = points.length - 1;
  return Array.from({ length: limit }, (_, index) => points[Math.round((index * lastIndex) / (limit - 1))]);
}

function hasAccuracy(point: RidePoint): point is RidePoint & { readonly accuracyM: number } {
  return point.accuracyM !== null;
}

function toPolicyLocation(point: RidePoint, accuracyM: number) {
  return {
    lat: point.latitude,
    lon: point.longitude,
    accuracyM,
    capturedAt: point.capturedAtIso,
  };
}
