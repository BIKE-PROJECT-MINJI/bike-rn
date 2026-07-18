import { z } from 'zod';
import type { RidePartyLocation, RidePartyMember, RidePartySocketToken, RidePartyUiModel } from './partyModels';

const apiResponseSchema = z.object({
  data: z.unknown().optional(),
});

const partySchema = z.object({
  id: z.number().int().positive(),
  courseId: z.number().int().positive(),
  hostUserId: z.number().int().positive(),
  title: z.string().min(1).max(120),
  scheduledStartAt: z.iso.datetime({ offset: true }).nullable(),
  capacity: z.number().int().min(1).max(10),
  joinedCount: z.number().int().nonnegative(),
  status: z.enum(['OPEN', 'RIDING', 'CANCELED']),
  currentUserMember: z.boolean(),
  currentUserHost: z.boolean(),
});

const partyListSchema = z.object({
  items: z.array(partySchema),
});

const memberListSchema = z.object({
  items: z.array(z.object({
    userId: z.number().int().positive(),
    role: z.enum(['HOST', 'MEMBER']),
    status: z.enum(['JOINED', 'LEFT']),
    joinedAt: z.iso.datetime({ offset: true }),
  })),
});

const socketTokenSchema = z.object({
  socketToken: z.string().min(1),
  expiresAt: z.iso.datetime({ offset: true }),
});

const socketMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('connected'), partyId: z.number().int().positive() }),
  z.object({
    type: z.literal('location'),
    data: z.object({
      partyId: z.number().int().positive(),
      userId: z.number().int().positive(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracyM: z.number().nonnegative().nullable(),
      speedMps: z.number().nonnegative().nullable(),
      bearingDeg: z.number().min(0).lt(360).nullable(),
      capturedAt: z.iso.datetime({ offset: true }),
    }),
  }),
  z.object({ type: z.literal('error'), message: z.string().min(1) }),
]);

export function mapRideParty(payload: unknown): RidePartyUiModel {
  const root = apiResponseSchema.parse(payload);
  return toUiModel(partySchema.parse(root.data));
}

export function mapRidePartyList(payload: unknown): readonly RidePartyUiModel[] {
  const root = apiResponseSchema.parse(payload);
  const data = partyListSchema.parse(root.data);
  return data.items.map(toUiModel);
}

export function mapRidePartyMembers(payload: unknown): readonly RidePartyMember[] {
  const root = apiResponseSchema.parse(payload);
  return memberListSchema.parse(root.data).items;
}

export function mapRidePartySocketToken(payload: unknown): RidePartySocketToken {
  const root = apiResponseSchema.parse(payload);
  return socketTokenSchema.parse(root.data);
}

export function parseRidePartySocketMessage(payload: string): RidePartyLocation | null {
  try {
    const raw: unknown = JSON.parse(payload);
    const result = socketMessageSchema.safeParse(raw);
    return result.success && result.data.type === 'location' ? result.data.data : null;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
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
