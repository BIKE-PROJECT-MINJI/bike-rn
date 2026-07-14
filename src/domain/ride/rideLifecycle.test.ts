import { appendRidePoint, createRideDraft, type RideDraft } from './rideQueueModel';
import {
  createRideLifecycleGate,
  pauseOrResumeRide,
  queueRideForUpload,
  reconcileRideLocationCollection,
  type RideLifecycleDependencies,
} from './rideLifecycle';

function pointDraft(clientRideId = 'ride-lifecycle'): RideDraft {
  return appendRidePoint(createRideDraft(clientRideId, 1_700_000_000_000), {
    latitude: 37.5665,
    longitude: 126.978,
    capturedAtIso: '2026-07-14T00:00:01.000Z',
    accuracyM: 5,
    speedMps: 3,
    bearingDeg: 30,
    altitudeM: null,
  });
}

function dependencies(initial: RideDraft): RideLifecycleDependencies & { current: RideDraft } {
  const state: RideLifecycleDependencies & { current: RideDraft } = {
    current: initial,
    nowMs: jest.fn(() => 1_700_000_020_000),
    captureCurrentLocation: jest.fn(async () => undefined),
    loadDraft: jest.fn((): RideDraft => state.current),
    updateDraft: jest.fn(async (
      _clientRideId: string,
      update: (draft: RideDraft) => RideDraft,
    ): Promise<RideDraft> => {
      state.current = update(state.current);
      return state.current;
    }),
    startCollection: jest.fn(async () => undefined),
    stopCollection: jest.fn(async () => undefined),
  };
  return state;
}

describe('ride lifecycle', () => {
  it('serializes a recovery operation behind an in-flight finish operation', async () => {
    const gate = createRideLifecycleGate();
    const events: string[] = [];
    let releaseFinish = (): void => {
      throw new Error('Finish release callback was not initialized.');
    };
    const finishBlocked = new Promise<void>((resolve) => {
      releaseFinish = resolve;
    });

    const finish = gate.run(async () => {
      events.push('finish-start');
      await finishBlocked;
      events.push('finish-end');
    });
    const reconcile = gate.run(async () => {
      events.push('reconcile');
    });

    await Promise.resolve();
    expect(events).toEqual(['finish-start']);
    releaseFinish();
    await Promise.all([finish, reconcile]);
    expect(events).toEqual(['finish-start', 'finish-end', 'reconcile']);
  });

  it('reloads SQLite after the final capture before deciding whether the ride has points', async () => {
    const initial = createRideDraft('ride-final-capture', 1_700_000_000_000);
    const deps = dependencies(initial);
    deps.captureCurrentLocation = jest.fn(async () => {
      deps.current = pointDraft('ride-final-capture');
    });

    const result = await queueRideForUpload(initial, deps);

    expect(result.queued.status).toBe('QUEUED');
    expect(result.queued.routePoints).toHaveLength(1);
    expect(deps.stopCollection).toHaveBeenCalledTimes(1);
  });

  it('keeps recording when the final capture fails and SQLite still has no point', async () => {
    const initial = createRideDraft('ride-no-point', 1_700_000_000_000);
    const deps = dependencies(initial);
    deps.captureCurrentLocation = jest.fn(async () => {
      throw new Error('location unavailable');
    });

    await expect(queueRideForUpload(initial, deps)).rejects.toThrow('GPS 포인트가 아직 수집되지 않았습니다.');
    expect(deps.updateDraft).not.toHaveBeenCalled();
    expect(deps.stopCollection).not.toHaveBeenCalled();
    expect(deps.current.status).toBe('RECORDING');
  });

  it('persists PAUSED before stopping native location collection', async () => {
    const events: string[] = [];
    const initial = pointDraft();
    const deps = dependencies(initial);
    deps.updateDraft = jest.fn(async (_clientRideId, update) => {
      events.push('persist');
      deps.current = update(deps.current);
      return deps.current;
    });
    deps.stopCollection = jest.fn(async () => {
      events.push('stop');
    });

    await pauseOrResumeRide(initial, deps);

    expect(events).toEqual(['persist', 'stop']);
    expect(deps.current.status).toBe('PAUSED');
  });

  it('persists QUEUED before stopping native location collection', async () => {
    const events: string[] = [];
    const initial = pointDraft();
    const deps = dependencies(initial);
    deps.updateDraft = jest.fn(async (_clientRideId, update) => {
      events.push('persist');
      deps.current = update(deps.current);
      return deps.current;
    });
    deps.stopCollection = jest.fn(async () => {
      events.push('stop');
    });

    await queueRideForUpload(initial, deps);

    expect(events).toEqual(['persist', 'stop']);
  });

  it('stops an orphan native task when no active SQLite draft exists', async () => {
    const deps = dependencies(pointDraft());

    await reconcileRideLocationCollection(null, deps);

    expect(deps.stopCollection).toHaveBeenCalledTimes(1);
    expect(deps.startCollection).not.toHaveBeenCalled();
  });
});
