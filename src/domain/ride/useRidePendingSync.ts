import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { restartBackgroundRideLocation, stopBackgroundRideLocation } from './backgroundRideLocation';
import { fetchRideStatus, recoverRideStatus, uploadRideDraft } from './rideApi';
import {
  completeRideDraft,
  listPendingRideDrafts,
  loadLegacyRideRecoverySummary,
  loadLatestRideReceipt,
  loadRideDraft,
  saveRideDraft,
  quarantineLegacyActiveRides,
} from './localRideQueue';
import type { LegacyRideRecoverySummary } from './localRideQueue';
import type { RideDraft, RideReceipt } from './rideQueueModel';
import { selectRideSessionDraft } from './rideSessionSelection';
import { syncRideDraft } from './rideSyncEngine';
import { createRideSyncGate } from './rideSyncGate';
import { createRideForegroundSyncTracker } from './rideForegroundSyncTracker';
import { messageForRideSyncResult } from './rideSyncPresentation';
import { exhaustedAutomaticRideDrafts, planRideSyncs } from './rideSyncSchedule';
import {
  isAutomaticRetryBudgetExhausted,
  RIDE_RETRY_BUDGET_EXHAUSTED_ERROR_CODE,
} from './rideRetryPolicy';
import { createRideUploadGate } from './rideUploadGate';
import { AUTHENTICATION_REQUIRED_ERROR_CODE } from './rideUploadPolicy';

export type RidePendingSyncState = {
  readonly draft: RideDraft | null;
  readonly pendingDrafts: readonly RideDraft[];
  readonly receipt: RideReceipt | null;
  readonly legacyRecovery: LegacyRideRecoverySummary;
  readonly syncing: boolean;
  readonly refreshLocal: () => void;
  readonly syncById: (clientRideId: string) => Promise<void>;
  readonly quarantineLegacyRides: () => Promise<void>;
};

export function useRidePendingSync(
  accessToken: string | null,
  onMessage: (message: string) => void,
  onError: (message: string | null) => void,
  currentUserId: number | null = null,
): RidePendingSyncState {
  const [pendingSnapshot, setPendingSnapshot] = useState<OwnedSnapshot<readonly RideDraft[]>>({
    ownerUserId: null,
    value: [],
  });
  const [receiptSnapshot, setReceiptSnapshot] = useState<OwnedSnapshot<RideReceipt | null>>({
    ownerUserId: null,
    value: null,
  });
  const [legacyRecovery, setLegacyRecovery] = useState<LegacyRideRecoverySummary>({
    activeDraftCount: 0,
    receiptCount: 0,
    totalCount: 0,
  });
  const [syncing, setSyncing] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const [activationId, setActivationId] = useState(AppState.currentState === 'active' ? 1 : 0);
  const [syncGate] = useState(createRideSyncGate);
  const [uploadGate] = useState(createRideUploadGate);
  const [foregroundSyncTracker] = useState(createRideForegroundSyncTracker);
  const syncCount = useRef(0);
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;
  const authRecoveryAttempts = useRef(new Set<string>());
  const authRecoveryToken = useRef<string | null>(null);

  const pendingDrafts = pendingSnapshot.ownerUserId === currentUserId ? pendingSnapshot.value : [];
  const receipt = receiptSnapshot.ownerUserId === currentUserId ? receiptSnapshot.value : null;

  const refreshLocal = useCallback(() => {
    if (currentUserIdRef.current !== currentUserId) {
      return;
    }
    const nextPendingDrafts = listPendingRideDrafts(currentUserId);
    const nextReceipt = loadLatestRideReceipt(currentUserId);
    const nextLegacyRecovery = loadLegacyRideRecoverySummary();
    if (currentUserIdRef.current !== currentUserId) {
      return;
    }
    setPendingSnapshot({ ownerUserId: currentUserId, value: nextPendingDrafts });
    setReceiptSnapshot({ ownerUserId: currentUserId, value: nextReceipt });
    setLegacyRecovery(nextLegacyRecovery);
  }, [currentUserId]);

  const quarantineLegacyRides = useCallback(async (): Promise<void> => {
    if (currentUserId === null) {
      onError('이전 버전 주행을 정리하려면 먼저 로그인해 주세요.');
      return;
    }
    syncCount.current += 1;
    setSyncing(true);
    onError(null);
    let collectionStopped = false;
    try {
      await stopBackgroundRideLocation();
      collectionStopped = true;
      await quarantineLegacyActiveRides();
      if (currentUserIdRef.current === currentUserId) {
        onMessage('이전 버전의 진행 중 주행을 종료하고 원본은 기기에 격리 보존했습니다.');
      }
    } catch (error) {
      const recoveryError = collectionStopped ? await restartAfterFailedQuarantine(error) : error;
      if (currentUserIdRef.current === currentUserId) {
        onError(errorMessage(recoveryError));
      }
    } finally {
      syncCount.current -= 1;
      setSyncing(syncCount.current > 0);
      refreshLocal();
    }
  }, [currentUserId, onError, onMessage, refreshLocal]);

  const runSyncById = useCallback(
    async (clientRideId: string, trigger: RideSyncTrigger): Promise<void> => syncGate.run(clientRideId, async () => {
      if (currentUserIdRef.current !== currentUserId) {
        return;
      }
      if (accessToken === null) {
        onError('저장 대기 중인 주행을 보내려면 다시 로그인해 주세요.');
        return;
      }
      const current = loadRideDraft(clientRideId);
      if (current === null || current.status === 'RECORDING' || current.status === 'PAUSED') {
        return;
      }
      if (currentUserId === null || current.ownerUserId !== currentUserId) {
        onError(rideOwnerMismatchMessage(current));
        return;
      }
      if (
        trigger === 'AUTO' &&
        current.rideRecordId === null &&
        isAutomaticRetryBudgetExhausted(current, current.attemptCount, Date.now())
      ) {
        await saveRideDraft({
          ...current,
          status: 'FAILED_USER_ACTION',
          nextRetryAtMs: null,
          lastErrorCode: RIDE_RETRY_BUDGET_EXHAUSTED_ERROR_CODE,
        });
        refreshLocal();
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
            complete: (receipt) => completeRideDraft(receipt, currentUserId),
          });
        const result = current.rideRecordId === null ? await uploadGate.run(runSync) : await runSync();
        if (result.status === 'FAILED_USER_ACTION' && result.errorCode === AUTHENTICATION_REQUIRED_ERROR_CODE) {
          authRecoveryAttempts.current.add(current.clientRideId);
        }
        if (currentUserIdRef.current === currentUserId) {
          onMessage(messageForRideSyncResult(result));
        }
      } catch (error) {
        if (currentUserIdRef.current === currentUserId) {
          onError(error instanceof Error ? error.message : UNKNOWN_RIDE_ERROR_MESSAGE);
        }
      } finally {
        syncCount.current -= 1;
        setSyncing(syncCount.current > 0);
        refreshLocal();
      }
    }),
    [accessToken, currentUserId, onError, onMessage, refreshLocal, syncGate, uploadGate],
  );

  const syncById = useCallback(
    (clientRideId: string): Promise<void> => runSyncById(clientRideId, 'MANUAL'),
    [runSyncById],
  );

  useEffect(() => {
    refreshLocal();
    const storageTimer = setInterval(refreshLocal, 5_000);
    return () => clearInterval(storageTimer);
  }, [refreshLocal]);

  useEffect(() => {
    if (authRecoveryToken.current !== accessToken) {
      authRecoveryToken.current = accessToken;
      authRecoveryAttempts.current.clear();
    }
    if (accessToken === null || appState !== 'active') {
      return;
    }
    for (const pending of pendingDrafts) {
      if (
        pending.status === 'FAILED_USER_ACTION' &&
        pending.lastErrorCode === AUTHENTICATION_REQUIRED_ERROR_CODE &&
        !authRecoveryAttempts.current.has(pending.clientRideId)
      ) {
        authRecoveryAttempts.current.add(pending.clientRideId);
        void runSyncById(pending.clientRideId, 'AUTO');
      }
    }
  }, [accessToken, appState, pendingDrafts, runSyncById]);

  useEffect(() => {
    if (accessToken === null || appState !== 'active') {
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const nowMs = Date.now();
    const exhausted = exhaustedAutomaticRideDrafts(pendingDrafts, nowMs);
    for (const draft of exhausted) {
      saveRideDraft({
        ...draft,
        status: 'FAILED_USER_ACTION',
        nextRetryAtMs: null,
        lastErrorCode: RIDE_RETRY_BUDGET_EXHAUSTED_ERROR_CODE,
      });
    }
    if (exhausted.length > 0) {
      refreshLocal();
    }
    for (const plan of planRideSyncs(pendingDrafts, nowMs)) {
      timers.push(setTimeout(() => void runSyncById(plan.clientRideId, 'AUTO'), plan.delayMs));
    }
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [accessToken, appState, pendingDrafts, refreshLocal, runSyncById]);

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
      void runSyncById(clientRideId, 'AUTO');
    }
  }, [activationId, appState, foregroundSyncTracker, pendingDrafts, runSyncById]);

  const draft = useMemo(() => selectRideSessionDraft(pendingDrafts), [pendingDrafts]);
  return { draft, pendingDrafts, receipt, legacyRecovery, syncing, refreshLocal, syncById, quarantineLegacyRides };
}

const UNKNOWN_RIDE_ERROR_MESSAGE = '주행 처리 중 알 수 없는 오류가 발생했습니다.';
type RideSyncTrigger = 'AUTO' | 'MANUAL';
type OwnedSnapshot<T> = { readonly ownerUserId: number | null; readonly value: T };

function rideOwnerMismatchMessage(draft: RideDraft): string {
  return draft.ownerUserId === null
    ? '이전 버전에서 기록한 주행의 계정을 확인할 수 없습니다. 원본은 기기에 보관됩니다.'
    : '다른 계정에서 기록한 주행입니다. 해당 계정으로 로그인해야 전송할 수 있습니다.';
}

async function restartAfterFailedQuarantine(quarantineError: unknown): Promise<unknown> {
  try {
    await restartBackgroundRideLocation();
    return quarantineError;
  } catch (restartError) {
    return new Error(
      `${errorMessage(quarantineError)} 위치 수집 재개도 실패했습니다: ${errorMessage(restartError)}`,
    );
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : UNKNOWN_RIDE_ERROR_MESSAGE;
}
