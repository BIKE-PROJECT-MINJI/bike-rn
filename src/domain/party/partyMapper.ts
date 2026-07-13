import { z } from 'zod';
import type { RidePartyUiModel } from './partyModels';

const apiResponseSchema = z.object({
  data: z.unknown().optional(),
});

const partySchema = z.object({
  id: z.coerce.number().default(0),
  courseId: z.coerce.number().default(0),
  hostUserId: z.coerce.number().default(0),
  title: z.string().optional().default('파티'),
  scheduledStartAt: z.string().nullable().optional(),
  capacity: z.coerce.number().default(0),
  joinedCount: z.coerce.number().default(0),
  status: z.string().optional().default('OPEN'),
  currentUserMember: z.boolean().optional().default(false),
  currentUserHost: z.boolean().optional().default(false),
});

const partyListSchema = z.object({
  items: z.array(partySchema).optional().default([]),
});

export function mapRideParty(payload: unknown): RidePartyUiModel {
  const root = apiResponseSchema.parse(payload);
  return toUiModel(partySchema.parse(root.data ?? {}));
}

export function mapRidePartyList(payload: unknown): readonly RidePartyUiModel[] {
  const root = apiResponseSchema.parse(payload);
  const data = partyListSchema.parse(root.data ?? {});
  return data.items.map(toUiModel);
}

function toUiModel(party: z.infer<typeof partySchema>): RidePartyUiModel {
  return {
    id: party.id,
    courseId: party.courseId,
    hostUserId: party.hostUserId,
    title: party.title,
    scheduledStartAt: party.scheduledStartAt ?? null,
    capacity: party.capacity,
    joinedCount: party.joinedCount,
    status: party.status,
    currentUserMember: party.currentUserMember,
    currentUserHost: party.currentUserHost,
  };
}
