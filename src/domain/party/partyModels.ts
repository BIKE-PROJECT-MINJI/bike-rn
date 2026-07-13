export type RidePartyUiModel = {
  readonly id: number;
  readonly courseId: number;
  readonly hostUserId: number;
  readonly title: string;
  readonly scheduledStartAt: string | null;
  readonly capacity: number;
  readonly joinedCount: number;
  readonly status: string;
  readonly currentUserMember: boolean;
  readonly currentUserHost: boolean;
};
