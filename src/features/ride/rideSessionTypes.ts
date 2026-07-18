import type { RideDraft, RideReceipt, RideStartContext } from '../../domain/ride/rideQueueModel';

export type RideSessionState = {
  readonly draft: RideDraft | null;
  readonly pendingDrafts: readonly RideDraft[];
  readonly receipt: RideReceipt | null;
  readonly authenticated: boolean;
  readonly nowMs: number;
  readonly busy: boolean;
  readonly message: string;
  readonly errorMessage: string | null;
  readonly elapsedMs: (draft: RideDraft) => number;
};

export type RideSessionActions = {
  readonly start: (context?: RideStartContext) => Promise<void>;
  readonly togglePause: () => Promise<void>;
  readonly finish: () => Promise<void>;
  readonly retry: () => Promise<void>;
  readonly retryById: (clientRideId: string) => Promise<void>;
};
