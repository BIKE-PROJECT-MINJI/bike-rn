export type RidePartyStatus = 'OPEN' | 'RIDING' | 'CANCELED';

export type RidePartyUiModel = {
  readonly id: number;
  readonly courseId: number;
  readonly hostUserId: number;
  readonly title: string;
  readonly scheduledStartAt: string | null;
  readonly capacity: number;
  readonly joinedCount: number;
  readonly status: RidePartyStatus;
  readonly currentUserMember: boolean;
  readonly currentUserHost: boolean;
};

export type RidePartyMember = {
  readonly userId: number;
  readonly role: 'HOST' | 'MEMBER';
  readonly status: 'JOINED' | 'LEFT';
  readonly joinedAt: string;
};

export type RidePartySocketToken = {
  readonly socketToken: string;
  readonly expiresAt: string;
};

export type RidePartyLocation = {
  readonly partyId: number;
  readonly userId: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyM: number | null;
  readonly speedMps: number | null;
  readonly bearingDeg: number | null;
  readonly capturedAt: string;
};
