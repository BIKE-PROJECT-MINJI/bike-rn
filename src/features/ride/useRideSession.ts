import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  captureCurrentRideLocation,
  requestRideLocationPermissions,
  restartBackgroundRideLocation,
  startBackgroundRideLocation,
  stopBackgroundRideLocation,
} from '../../domain/ride/backgroundRideLocation';
import { fetchRideStatus, uploadRideDraft } from '../../domain/ride/rideApi';
import {
  completeRideDraft,
  createRideDraftIfQueueEmpty,
  discardRideDraft,
  listPendingRideDrafts,
  loadActiveRideDraft,
  loadLatestRideReceipt,
  loadRideDraft,
  saveRideDraft,
  updateRideDraft,
} from '../../domain/ride/localRideQueue';
import {
  createRideLifecycleGate,
  pauseOrResumeRide,
  queueRideForUpload,
  reconcileRideLocationCollection,
  type RideLifecycleDependencies,
} from '../../domain/ride/rideLifecycle';
import {
  createRideDraft,
  rideElapsedMs,
  type RideDraft,
  type RideReceipt,
} from '../../domain/ride/rideQueueModel';
import { syncRideDraft, type RideSyncResult } from '../../domain/ride/rideSyncEngine';
import { createRideSyncGate } from '../../domain/ride/rideSyncGate';
import { createActiveReconcileScheduler } from './activeReconcileScheduler';

export type RideSessionState = {
  readonly draft: RideDraft | null;
  readonly receipt: RideReceipt | null;
  readonly nowMs: number;
  readonly busy: boolean;
  readonly message: string;
  readonly errorMessage: string | null;
};

export type RideSessionActions = {
  readonly start: () => Promise<void>;
  readonly togglePause: () => Promise<void>;
  readonly finish: () => Promise<void>;
  readonly retry: () => Promise<void>;
};

export function useRideSession(accessToken: string | null): RideSessionState & RideSessionActions {
  const [draft, setDraft] = useState<RideDraft | null>(null);
  const [receipt, setReceipt] = useState<RideReceipt | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('주행을 시작할 준비가 됐습니다.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [syncGate] = useState(createRideSyncGate);
  const [lifecycleGate] = useState(createRideLifecycleGate);
  const startInFlight = useRef(false);
  const reconcileInFlight = useRef<Promise<void> | null>(null);

  const refreshLocal = useCallback(() => {
    setDraft(listPendingRideDrafts().at(0) ?? null);
    setReceipt(loadLatestRideReceipt());
  }, []);

  const syncById = useCallback(
    async (clientRideId: string): Promise<void> => syncGate.run(clientRideId, async () => {
      if (accessToken === null) {
        setErrorMessage('저장 대기 중인 주행을 보내려면 다시 로그인해 주세요.');
        return;
      }
      const current = loadRideDraft(clientRideId);
      if (current === null || current.status === 'RECORDING' || current.status === 'PAUSED') {
        return;
      }
      setBusy(true);
      setErrorMessage(null);
      try {
        const result = await syncRideDraft(current, {
          nowMs: Date.now,
          saveRemote: (queued) => uploadRideDraft(queued, accessToken),
          getRemoteStatus: (rideRecordId) => fetchRideStatus(rideRecordId, accessToken),
          persist: saveRideDraft,
          complete: completeRideDraft,
        });
        setMessage(messageForSyncResult(result));
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : UNKNOWN_RIDE_ERROR_MESSAGE);
      } finally {
        refreshLocal();
        setBusy(false);
      }
    }),
    [accessToken, refreshLocal, syncGate],
  );

  useEffect(() => {
    refreshLocal();
    const clockTimer = setInterval(() => setNowMs(Date.now()), 1_000);
    const storageTimer = setInterval(refreshLocal, 5_000);
    return () => {
      clearInterval(clockTimer);
      clearInterval(storageTimer);
    };
  }, [refreshLocal]);

  const reconcileLocalRide = useCallback(async (): Promise<void> => {
    if (reconcileInFlight.current !== null) {
      await reconcileInFlight.current;
      return;
    }
    const reconcile = lifecycleGate.run(async () => {
      try {
        const active = loadActiveRideDraft();
        if (active?.status === 'RECORDING') {
          setErrorMessage(null);
        }
        await reconcileRideLocationCollection(active, RIDE_RECOVERY_DEPENDENCIES);
        if (active?.status === 'RECORDING') {
          setMessage('중단됐던 주행을 복구했습니다. 위치 수집 재연결을 요청했고 새 위치를 확인 중입니다.');
        } else if (active?.status === 'PAUSED') {
          setMessage('일시정지된 주행을 복구했습니다.');
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : '저장된 주행의 위치 수집을 다시 연결하지 못했습니다.',
        );
      } finally {
        refreshLocal();
      }
    });
    reconcileInFlight.current = reconcile;
    try {
      await reconcile;
    } finally {
      if (reconcileInFlight.current === reconcile) {
        reconcileInFlight.current = null;
      }
    }
  }, [lifecycleGate, refreshLocal]);

  useEffect(() => {
    const scheduler = createActiveReconcileScheduler(reconcileLocalRide, () => AppState.currentState);
    scheduler.onAppStateChange(AppState.currentState);
    const subscription = AppState.addEventListener('change', (nextState) => {
      scheduler.onAppStateChange(nextState);
    });
    return () => {
      scheduler.dispose();
      subscription.remove();
    };
  }, [reconcileLocalRide]);

  useEffect(() => {
    if (draft === null || accessToken === null) {
      return;
    }
    const delayMs = syncDelayMs(draft, Date.now());
    if (delayMs === null) {
      return;
    }
    const timer = setTimeout(() => {
      void syncById(draft.clientRideId);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [accessToken, draft?.clientRideId, draft?.nextRetryAtMs, draft?.status, syncById]);

  const start = useCallback(async () => {
    if (startInFlight.current) {
      return;
    }
    startInFlight.current = true;
    try {
      await lifecycleGate.run(async () => {
        if (accessToken === null) {
          setErrorMessage('내 정보 탭에서 로그인한 뒤 주행을 시작해 주세요.');
          return;
        }
        if (listPendingRideDrafts().length > 0) {
          setErrorMessage('먼저 저장 대기 중인 주행을 완료해 주세요.');
          refreshLocal();
          return;
        }
        setBusy(true);
        setErrorMessage(null);
        try {
          const permission = await requestRideLocationPermissions();
          if (permission !== 'GRANTED') {
            setErrorMessage(
              permission === 'FOREGROUND_DENIED'
                ? '주행 기록을 시작하려면 정확한 위치 권한이 필요합니다.'
                : '화면 잠금 중 기록을 위해 위치 권한을 항상 허용으로 바꿔 주세요.',
            );
            return;
          }
          const next = createRideDraft(`ride-${Crypto.randomUUID()}`, Date.now());
          if (!(await createRideDraftIfQueueEmpty(next))) {
            setErrorMessage('이미 시작했거나 저장 대기 중인 주행이 있습니다.');
            refreshLocal();
            return;
          }
          try {
            await startBackgroundRideLocation();
          } catch (error) {
            await discardRideDraft(next.clientRideId);
            throw error;
          }
          setDraft(next);
          setMessage('주행 기록 중입니다. 화면을 잠가도 로컬에 계속 저장합니다.');
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : UNKNOWN_RIDE_ERROR_MESSAGE);
        } finally {
          setBusy(false);
        }
      });
    } finally {
      startInFlight.current = false;
    }
  }, [accessToken, lifecycleGate, refreshLocal]);

  const togglePause = useCallback(async () => lifecycleGate.run(async () => {
    const active = loadActiveRideDraft();
    if (active !== null) {
      setBusy(true);
      setErrorMessage(null);
      try {
        const next = await pauseOrResumeRide(active, RIDE_LIFECYCLE_DEPENDENCIES);
        setDraft(next);
        setMessage(next.status === 'PAUSED' ? '주행 기록을 일시정지했습니다.' : '주행 기록을 다시 시작했습니다.');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : UNKNOWN_RIDE_ERROR_MESSAGE);
        refreshLocal();
      } finally {
        setBusy(false);
      }
    }
  }), [lifecycleGate, refreshLocal]);

  const finish = useCallback(async () => lifecycleGate.run(async () => {
    const active = loadActiveRideDraft();
    if (active === null) {
      return;
    }
    const finishRequestedAtMs = Date.now();
    if (rideElapsedMs(active, finishRequestedAtMs) < 10_000) {
      setErrorMessage('10초 이상 주행한 뒤 종료해 주세요.');
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      const result = await queueRideForUpload(active, RIDE_LIFECYCLE_DEPENDENCIES);
      const { queued } = result;
      setDraft(queued);
      setMessage(
        result.finalCaptureError !== null
          ? '주행은 로컬에 보존했습니다. 마지막 위치 확인 경고와 함께 서버 저장을 시작합니다.'
          : '주행을 로컬에 보존했습니다. 서버 저장을 시작합니다.',
      );
      if (result.collectionStopError !== null) {
        setErrorMessage('주행은 저장됐지만 위치 서비스 종료를 확인하지 못했습니다. 앱을 다시 열어 상태를 정리해 주세요.');
      } else if (result.finalCaptureError !== null) {
        setErrorMessage(`마지막 위치 확인 실패: ${result.finalCaptureError.message}`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : UNKNOWN_RIDE_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }), [lifecycleGate]);

  const retry = useCallback(async () => {
    if (draft !== null) {
      await syncById(draft.clientRideId);
    }
  }, [draft, syncById]);

  return { draft, receipt, nowMs, busy, message, errorMessage, start, togglePause, finish, retry };
}

function syncDelayMs(draft: RideDraft, nowMs: number): number | null {
  if (draft.status === 'FINALIZING') {
    return 2_000;
  }
  if (draft.status === 'QUEUED' || draft.status === 'UPLOADING') {
    return 0;
  }
  if (draft.status === 'RETRY_WAIT') {
    return Math.max(0, (draft.nextRetryAtMs ?? nowMs) - nowMs);
  }
  return null;
}

function messageForSyncResult(result: RideSyncResult): string {
  switch (result.status) {
    case 'FINALIZING':
      return '서버 저장 완료. 주행 기록을 보정하고 있습니다.';
    case 'READY':
      return '주행 기록 보정이 완료됐습니다.';
    case 'RETRY_WAIT':
      return '로컬 기록은 안전합니다. 잠시 후 같은 ID로 다시 전송합니다.';
    case 'FAILED_USER_ACTION':
      return '로그인 상태를 확인한 뒤 다시 전송해 주세요.';
    case 'FAILED_TERMINAL':
      return '서버가 주행 데이터를 처리하지 못했습니다. 로컬 기록은 유지됩니다.';
  }
}

const UNKNOWN_RIDE_ERROR_MESSAGE = '주행 처리 중 알 수 없는 오류가 발생했습니다.';

const RIDE_LIFECYCLE_DEPENDENCIES: RideLifecycleDependencies = {
  nowMs: Date.now,
  captureCurrentLocation: captureCurrentRideLocation,
  loadDraft: loadRideDraft,
  updateDraft: updateRideDraft,
  startCollection: startBackgroundRideLocation,
  stopCollection: stopBackgroundRideLocation,
};

const RIDE_RECOVERY_DEPENDENCIES: RideLifecycleDependencies = {
  ...RIDE_LIFECYCLE_DEPENDENCIES,
  startCollection: restartBackgroundRideLocation,
};
