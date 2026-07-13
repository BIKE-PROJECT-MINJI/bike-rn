import { z } from 'zod';
import { apiRequest } from '../../shared/api/apiClient';
import type { RideDraft } from './rideQueueModel';
import type { RemoteRideSaveResult, RemoteRideStatusResult } from './rideSyncEngine';

const rideSaveResponseSchema = z.object({
  data: z.object({
    rideRecordId: z.number().int().positive(),
    finalizationStatus: z.enum(['FINALIZING', 'READY', 'FAILED']),
  }),
});

const rideStatusResponseSchema = z.object({
  data: z.object({
    rideRecordId: z.number().int().positive(),
    status: z.enum(['FINALIZING', 'READY', 'FAILED']),
    linkedCourseId: z.number().int().positive().nullable(),
  }),
});

const rideListResponseSchema = z.object({
  data: z.object({
    items: z.array(
      z.object({
        rideRecordId: z.number().int().positive(),
        distanceM: z.number().int().nonnegative(),
        durationSec: z.number().int().nonnegative(),
        finalizationStatus: z.enum(['FINALIZING', 'READY', 'FAILED']),
      }),
    ),
  }),
});

const rideSaveRequestSchema = z.object({
  clientRideId: z.string().min(1).max(80),
  startedAt: z.iso.datetime({ offset: true }),
  endedAt: z.iso.datetime({ offset: true }),
  summary: z.object({
    distanceM: z.number().int().nonnegative(),
    durationSec: z.number().int().positive(),
  }),
  routePoints: z.array(
    z.object({
      pointOrder: z.number().int().positive(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      capturedAt: z.iso.datetime({ offset: true }),
      accuracyM: z.number().nonnegative().nullable(),
      speedMps: z.number().nonnegative().nullable(),
      bearingDeg: z.number().min(0).lt(360).nullable(),
      altitudeM: z.number().nullable(),
      distanceToRouteM: z.null(),
      routeProgressPct: z.null(),
    }),
  ),
});

export type RideListItem = z.infer<typeof rideListResponseSchema>['data']['items'][number];
export type RideSaveRequest = z.infer<typeof rideSaveRequestSchema>;

export async function uploadRideDraft(draft: RideDraft, accessToken: string): Promise<RemoteRideSaveResult> {
  const body = buildRideSaveRequest(draft);
  const payload = await apiRequest<unknown>('/api/v1/ride-records', {
    method: 'POST',
    accessToken,
    body,
  });
  return rideSaveResponseSchema.parse(payload).data;
}

export function buildRideSaveRequest(draft: RideDraft): RideSaveRequest {
  if (draft.endedAtIso === null) {
    throw new UnfinishedRideDraftError(draft.clientRideId);
  }
  return rideSaveRequestSchema.parse({
    clientRideId: draft.clientRideId,
    startedAt: draft.startedAtIso,
    endedAt: draft.endedAtIso,
    summary: {
      distanceM: Math.round(draft.distanceMeters),
      durationSec: Math.max(1, Math.round(draft.accumulatedActiveMs / 1000)),
    },
    routePoints: draft.routePoints.map((point) => ({
      pointOrder: point.pointOrder,
      latitude: point.latitude,
      longitude: point.longitude,
      capturedAt: point.capturedAtIso,
      accuracyM: point.accuracyM,
      speedMps: point.speedMps,
      bearingDeg: point.bearingDeg,
      altitudeM: point.altitudeM,
      distanceToRouteM: null,
      routeProgressPct: null,
    })),
  });
}

export async function fetchRideStatus(rideRecordId: number, accessToken: string): Promise<RemoteRideStatusResult> {
  const payload = await apiRequest<unknown>(`/api/v1/ride-records/${rideRecordId}`, { accessToken });
  return rideStatusResponseSchema.parse(payload).data;
}

export async function fetchRideRecords(accessToken: string): Promise<readonly RideListItem[]> {
  const payload = await apiRequest<unknown>('/api/v1/ride-records', { accessToken });
  return rideListResponseSchema.parse(payload).data.items;
}

class UnfinishedRideDraftError extends Error {
  readonly clientRideId: string;

  constructor(clientRideId: string) {
    super('종료되지 않은 주행은 서버에 전송할 수 없습니다.');
    this.name = 'UnfinishedRideDraftError';
    this.clientRideId = clientRideId;
  }
}
