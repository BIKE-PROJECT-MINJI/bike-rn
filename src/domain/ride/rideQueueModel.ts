import { z } from 'zod';

const ridePointSchema = z.object({
  pointOrder: z.number().int().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  capturedAtIso: z.iso.datetime({ offset: true }),
  accuracyM: z.number().nonnegative().nullable(),
  speedMps: z.number().nonnegative().nullable(),
  bearingDeg: z.number().min(0).lt(360).nullable(),
  altitudeM: z.number().nullable(),
});

const rideDraftStatusSchema = z.enum([
  'RECORDING',
  'PAUSED',
  'QUEUED',
  'UPLOADING',
  'RETRY_WAIT',
  'FINALIZING',
  'FAILED_USER_ACTION',
  'FAILED_TERMINAL',
]);

const rideModeSchema = z.enum(['FREE', 'COURSE', 'PARTY']);

const rideDraftSchema = z.object({
  clientRideId: z.string().min(1).max(80),
  mode: rideModeSchema.default('FREE'),
  courseId: z.number().int().positive().nullable().default(null),
  courseTitle: z.string().min(1).max(200).nullable().default(null),
  partyId: z.number().int().positive().nullable().default(null),
  status: rideDraftStatusSchema,
  startedAtIso: z.iso.datetime({ offset: true }),
  endedAtIso: z.iso.datetime({ offset: true }).nullable(),
  accumulatedActiveMs: z.number().int().nonnegative(),
  activeSegmentStartedAtMs: z.number().int().nonnegative().nullable(),
  distanceMeters: z.number().nonnegative(),
  routePoints: z.array(ridePointSchema),
  attemptCount: z.number().int().nonnegative(),
  nextRetryAtMs: z.number().int().nonnegative().nullable(),
  lastErrorCode: z.string().nullable(),
  lastLocationErrorCode: z.string().nullable().default(null),
  rideRecordId: z.number().int().positive().nullable(),
  finalizationStartedAtMs: z.number().int().nonnegative().nullable().default(null),
  lastFinalizationPollAtMs: z.number().int().nonnegative().nullable().default(null),
});

export type RidePoint = z.infer<typeof ridePointSchema>;
export type RideDraft = z.infer<typeof rideDraftSchema>;
export type RideDraftStatus = z.infer<typeof rideDraftStatusSchema>;
export type RideMode = z.infer<typeof rideModeSchema>;
export type RidePointInput = Omit<RidePoint, 'pointOrder'>;
export type RideStartContext = {
  readonly mode: RideMode;
  readonly courseId: number | null;
  readonly courseTitle: string | null;
  readonly partyId: number | null;
};

export type RideReceipt = {
  readonly clientRideId: string;
  readonly rideRecordId: number;
  readonly status: 'READY';
  readonly completedAtMs: number;
  readonly linkedCourseId: number | null;
};

export function createRideDraft(
  clientRideId: string,
  startedAtMs: number,
  context: RideStartContext = { mode: 'FREE', courseId: null, courseTitle: null, partyId: null },
): RideDraft {
  return rideDraftSchema.parse({
    clientRideId,
    ...context,
    status: 'RECORDING',
    startedAtIso: new Date(startedAtMs).toISOString(),
    endedAtIso: null,
    accumulatedActiveMs: 0,
    activeSegmentStartedAtMs: startedAtMs,
    distanceMeters: 0,
    routePoints: [],
    attemptCount: 0,
    nextRetryAtMs: null,
    lastErrorCode: null,
    lastLocationErrorCode: null,
    rideRecordId: null,
    finalizationStartedAtMs: null,
    lastFinalizationPollAtMs: null,
  });
}

export function finishRideDraft(draft: RideDraft, endedAtMs: number): RideDraft {
  const activeSegmentMs =
    draft.status === 'RECORDING' && draft.activeSegmentStartedAtMs !== null
      ? Math.max(0, endedAtMs - draft.activeSegmentStartedAtMs)
      : 0;
  return rideDraftSchema.parse({
    ...draft,
    status: 'QUEUED',
    endedAtIso: new Date(endedAtMs).toISOString(),
    accumulatedActiveMs: draft.accumulatedActiveMs + activeSegmentMs,
    activeSegmentStartedAtMs: null,
    nextRetryAtMs: null,
    lastErrorCode: null,
  });
}

export function canManuallyRetryRide(draft: RideDraft): boolean {
  return draft.status === 'FAILED_USER_ACTION';
}

export function appendRidePoint(draft: RideDraft, point: RidePointInput): RideDraft {
  return appendRidePoints(draft, [point]);
}

export function appendRidePoints(draft: RideDraft, points: readonly RidePointInput[]): RideDraft {
  return appendRidePointsFromOrder(draft, points, draft.routePoints.length + 1);
}

export function appendRidePointsFromOrder(
  draft: RideDraft,
  points: readonly RidePointInput[],
  firstPointOrder: number,
): RideDraft {
  if (draft.status !== 'RECORDING') {
    return draft;
  }
  if (!Number.isInteger(firstPointOrder) || firstPointOrder < 1) {
    throw new RangeError('첫 위치 포인트 순번은 1 이상의 정수여야 합니다.');
  }
  let previous = draft.routePoints.at(-1);
  let distanceDelta = 0;
  const orderedPoints = points.map((point, index) => {
    if (previous) {
      distanceDelta += distanceBetweenMeters(
        previous.latitude,
        previous.longitude,
        point.latitude,
        point.longitude,
      );
    }
    const orderedPoint: RidePoint = { ...point, pointOrder: firstPointOrder + index };
    previous = orderedPoint;
    return orderedPoint;
  });
  return rideDraftSchema.parse({
    ...draft,
    distanceMeters: draft.distanceMeters + distanceDelta,
    routePoints: [...draft.routePoints, ...orderedPoints],
    lastLocationErrorCode: null,
  });
}

export function markRideLocationError(draft: RideDraft, errorCode: string): RideDraft {
  return rideDraftSchema.parse({ ...draft, lastLocationErrorCode: errorCode });
}

export function pauseRideDraft(draft: RideDraft, pausedAtMs: number): RideDraft {
  if (draft.status !== 'RECORDING' || draft.activeSegmentStartedAtMs === null) {
    return draft;
  }
  return rideDraftSchema.parse({
    ...draft,
    status: 'PAUSED',
    accumulatedActiveMs:
      draft.accumulatedActiveMs + Math.max(0, pausedAtMs - draft.activeSegmentStartedAtMs),
    activeSegmentStartedAtMs: null,
  });
}

export function resumeRideDraft(draft: RideDraft, resumedAtMs: number): RideDraft {
  if (draft.status !== 'PAUSED') {
    return draft;
  }
  return rideDraftSchema.parse({
    ...draft,
    status: 'RECORDING',
    activeSegmentStartedAtMs: resumedAtMs,
  });
}

export function rideElapsedMs(draft: RideDraft, nowMs: number): number {
  const activeSegmentMs =
    draft.status === 'RECORDING' && draft.activeSegmentStartedAtMs !== null
      ? Math.max(0, nowMs - draft.activeSegmentStartedAtMs)
      : 0;
  return draft.accumulatedActiveMs + activeSegmentMs;
}

export function parsePersistedRideDraft(raw: string): RideDraft {
  try {
    const parsed: unknown = JSON.parse(raw);
    return rideDraftSchema.parse(parsed);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw new CorruptedRideDraftError();
    }
    throw error;
  }
}

export function parsePersistedRidePoint(raw: string): RidePoint {
  try {
    const parsed: unknown = JSON.parse(raw);
    return ridePointSchema.parse(parsed);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      throw new CorruptedRideDraftError();
    }
    throw error;
  }
}

class CorruptedRideDraftError extends Error {
  constructor() {
    super('저장된 주행 데이터가 손상되었습니다.');
    this.name = 'CorruptedRideDraftError';
  }
}

function distanceBetweenMeters(
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
): number {
  const latitudeDelta = degreesToRadians(endLatitude - startLatitude);
  const longitudeDelta = degreesToRadians(endLongitude - startLongitude);
  const startLatitudeRadians = degreesToRadians(startLatitude);
  const endLatitudeRadians = degreesToRadians(endLatitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitudeRadians) * Math.cos(endLatitudeRadians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}
