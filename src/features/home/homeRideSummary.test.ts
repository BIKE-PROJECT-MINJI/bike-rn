import { createRideDraft, finishRideDraft, type RideDraft } from '../../domain/ride/rideQueueModel';
import { countPendingRideUploads } from './homeRideSummary';

describe('countPendingRideUploads', () => {
  it('진행 중인 주행은 저장 대기 건수에서 제외한다', () => {
    const recording = createRideDraft('recording', 1_700_000_000_000);
    const paused: RideDraft = { ...createRideDraft('paused', 1_700_000_000_000), status: 'PAUSED' };
    const queued = finishRideDraft(createRideDraft('queued', 1_700_000_000_000), 1_700_000_060_000);
    const finalizing: RideDraft = { ...queued, clientRideId: 'finalizing', status: 'FINALIZING', rideRecordId: 42 };

    expect(countPendingRideUploads([recording, paused, queued, finalizing])).toBe(2);
  });
});
