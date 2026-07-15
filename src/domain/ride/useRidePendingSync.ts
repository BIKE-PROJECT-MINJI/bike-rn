import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchRideStatus, recoverRideStatus, uploadRideDraft } from './rideApi';
import {
  completeRideDraft,
  listPendingRideDrafts,
  loadLatestRideReceipt,
  loadRideDraft,
  saveRideDraft,
} from './localRideQueue';
import type { RideDraft, RideReceipt } from './rideQueueModel';
import { selectRideSessionDraft } from './rideSessionSelection';
import { syncRideDraft } from './rideSyncEngine';
import { createRideSyncGate } from './rideSyncGate';
import { createRideForegroundSyncTracker } from './rideForegroundSyncTracker';
import { messageForRideSyncResult } from './rideSyncPresentation';
import { planRideSyncs } from './rideSyncSchedule';
import { createRideUploadGate } from './rideUploadGate';

export type RidePendingSyncState = {
  readonly draft: RideDraft | null;
  readonly pendingDrafts: readonly RideDraft[];
  readonly receipt: RideReceipt | null;
  readonly syncing: boolean;
  readonly refreshLocal: () => void;
  readonly syncById: (clientRideId: string) => Promise<void>;
};

export function useRidePendingSync(
  accessToken: string | null,
  onMessage: (message: string) => void,
  onError: (message: string | null) => void,
): RidePendingSyncState {
  const [pendingDrafts, setPendingDrafts] = useState<readonly RideDraft[]>([]);
  const [receipt, setReceipt] = useState<RideReceipt | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [activationId, setActivationId] = useState(AppState.currentState === 'active' ? 1 : 0);
  const [syncGate] = useState(createRideSyncGate);
  const [uploadGate] = useState(createRideUploadGate);
  const [foregroundSyncTracker] = useState(createRideForegroundSyncTracker);
  const syncCount = useRef(0);

  const refreshLocal = useCallback(() => {
    setPendingDrafts(listPendingRideDrafts());
    setReceipt(loadLatestRideReceipt());
  }, []);

  const syncById = useCallback(
    async (clientRideId: string): Promise<void> => syncGate.run(clientRideId, async () => {
      if (accessToken === null) {
        onError('저장 대기 중인 주행을 보내려면 다시 로그인해 주세요.');
        return;
      }
      const current = loadRideDraft(clientRideId);
      if (current === null || current.status === 'RECORDING' || current.status === 'PAUSED') {
        return;
      }
      syncCount.current += 1;
      setSyncing(true);
      onError(null);
      try {
        const runSync = () =>
          syncRideDraft(current, {
            nowMs: Date.now,
            recoverRemote: (clientRideId) => recoverRideStatus(clientRideId, accessToken),
            saveRemote: (queued) => uploadRideDraft(queued, accessToken),
            getRemoteStatus: (rideRecordId) => fetchRideStatus(rideRecordId, accessToken),
            persist: saveRideDraft,
            complete: completeRideDraft,
          });
        const result = current.rideRecordId === null ? await uploadGate.run(runSync) : await runSync();
        onMessage(messageForRideSyncResult(result));
      } catch (error) {
        onError(error instanceof Error ? error.message : UNKNOWN_RIDE_ERROR_MESSAGE);
      } finally {
        syncCount.current -= 1;
        setSyncing(syncCount.current > 0);
        refreshLocal();
      }
    }),
    [accessToken, onError, onMessage, refreshLocal, syncGate, uploadGate],
  );

  useEffect(() => {
    refreshLocal();
    const storageTimer = setInterval(refreshLocal, 5_000);
    return () => clearInterval(storageTimer);
  }, [refreshLocal]);

  useEffect(() => {
    if (accessToken === null || appState !== 'active') {
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const plan of planRideSyncs(pendingDrafts, Date.now())) {
      timers.push(setTimeout(() => void syncById(plan.clientRideId), plan.delayMs));
    }
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [accessToken, appState, pendingDrafts, syncById]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);
      if (previousState !== 'active' && nextState === 'active') {
        setActivationId((current) => current + 1);
      }
      previousState = nextState;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (appState !== 'active' || activationId === 0) {
      return;
    }
    for (const clientRideId of foregroundSyncTracker.selectOnce(activationId, pendingDrafts)) {
      void syncById(clientRideId);
    }
  }, [activationId, appState, foregroundSyncTracker, pendingDrafts, syncById]);

  const draft = useMemo(() => selectRideSessionDraft(pendingDrafts), [pendingDrafts]);
  return { draft, pendingDrafts, receipt, syncing, refreshLocal, syncById };
}

const UNKNOWN_RIDE_ERROR_MESSAGE = '주행 처리 중 알 수 없는 오류가 발생했습니다.';
