import type { RideDraft } from './rideQueueModel';

export const RIDE_RETRY_BUDGET_EXHAUSTED_ERROR_CODE = 'RIDE_RETRY_BUDGET_EXHAUSTED';

const MAX_AUTOMATIC_RETRY_ATTEMPTS = 8;
const MAX_AUTOMATIC_RETRY_AGE_MS = 24 * 60 * 60 * 1000;

export function isAutomaticRetryBudgetExhausted(
  draft: RideDraft,
  nextAttemptCount: number,
  nowMs: number,
): boolean {
  const referenceTimeMs = Date.parse(draft.endedAtIso ?? draft.startedAtIso);
  const ageMs = Math.max(0, nowMs - referenceTimeMs);
  return nextAttemptCount >= MAX_AUTOMATIC_RETRY_ATTEMPTS || ageMs >= MAX_AUTOMATIC_RETRY_AGE_MS;
}
