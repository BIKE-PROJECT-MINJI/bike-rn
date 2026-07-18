import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  requestRideLocationPermissions,
  startBackgroundRideLocation,
} from '../../domain/ride/backgroundRideLocation';
import {
  createRideDraftIfQueueEmpty,
  discardRideDraft,
  loadAnyActiveRideDraftForBackgroundTask,
  loadActiveRideDraft,
} from '../../domain/ride/localRideQueue';
import {
  createRideLifecycleGate,
  pauseOrResumeRide,
  queueRideForUpload,
  reconcileRideLocationCollection,
} from '../../domain/ride/rideLifecycle';
import {
  createRideDraft,
  rideElapsedMs,
  type RideDraft,
  type RideStartContext,
} from '../../domain/ride/rideQueueModel';
import {
  RIDE_LIFECYCLE_DEPENDENCIES,
  RIDE_RECOVERY_DEPENDENCIES,
} from '../../domain/ride/rideSessionDependencies';
import { useRideSyncCoordinator } from '../../domain/ride/RideSyncContext';
import {
  createActiveReconcileScheduler,
  createActiveRideRecoveryMessageGate,
} from './activeReconcileScheduler';
import type { RideSessionActions, RideSessionState } from './rideSessionTypes';

export function useRideSession(_legacyAccessToken?: string | null): RideSessionState & RideSessionActions {
  const {
    accessToken,
    userId,
    draft,
    pendingDrafts,
    receipt,
    syncing,
    message,
    errorMessage,
    refreshLocal,
    syncById,
    setMessage,
    setErrorMessage,
  } = useRideSyncCoordinator();
  const [nowMs, setNowMs] = useState(Date.now());
  const [actionBusy, setActionBusy] = useState(false);
  const [lifecycleGate] = useState(createRideLifecycleGate);
  const [recoveryMessageGate] = useState(() =>
    createActiveRideRecoveryMessageGate(loadActiveRideDraft(userId)?.clientRideId ?? null),
  );
  const startInFlight = useRef(false);
  const reconcileInFlight = useRef<Promise<void> | null>(null);

  const busy = actionBusy || syncing;
  const elapsedMs = useCallback((rideDraft: RideDraft) => rideElapsedMs(rideDraft, nowMs), [nowMs]);

  useEffect(() => {
    refreshLocal();
    const clockTimer = setInterval(() => setNowMs(Date.now()), 1_000);
    const activeRideTimer = setInterval(refreshLocal, 2_000);
    return () => {
      clearInterval(clockTimer);
      clearInterval(activeRideTimer);
    };
  }, [refreshLocal]);

  const reconcileLocalRide = useCallback(async (): Promise<void> => {
    if (reconcileInFlight.current !== null) {
      await reconcileInFlight.current;
      return;
    }
    const reconcile = lifecycleGate.run(async () => {
      try {
        const deviceActive = loadAnyActiveRideDraftForBackgroundTask();
        const ownedActive = deviceActive?.ownerUserId === userId ? deviceActive : null;
        if (userId !== null && deviceActive?.status === 'RECORDING' && ownedActive === null) {
          await pauseOrResumeRide(deviceActive, RIDE_LIFECYCLE_DEPENDENCIES);
          setErrorMessage('계정이 변경되어 이전 계정의 주행 기록을 일시정지했습니다. 해당 계정으로 로그인해 이어가 주세요.');
          return;
        }
        if (ownedActive?.status === 'RECORDING') {
          setErrorMessage(null);
        }
        await reconcileRideLocationCollection(deviceActive, RIDE_RECOVERY_DEPENDENCIES);
        const recoveryMessage = ownedActive?.status === 'RECORDING' || ownedActive?.status === 'PAUSED'
          ? recoveryMessageGate.messageFor({ clientRideId: ownedActive.clientRideId, status: ownedActive.status })
          : null;
        if (recoveryMessage !== null) {
          setMessage(recoveryMessage);
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
  }, [lifecycleGate, recoveryMessageGate, refreshLocal, userId]);

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

  const start = useCallback(async (context?: RideStartContext) => {
    if (startInFlight.current) {
      return;
    }
    startInFlight.current = true;
    try {
      await lifecycleGate.run(async () => {
        if (accessToken === null || userId === null) {
          setErrorMessage('내 정보 탭에서 로그인한 뒤 주행을 시작해 주세요.');
          return;
        }
        const deviceActive = loadAnyActiveRideDraftForBackgroundTask();
        if (deviceActive !== null) {
          setErrorMessage(activeRideConflictMessage(deviceActive, userId));
          refreshLocal();
          return;
        }
        setActionBusy(true);
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
          const next = createRideDraft(`ride-${Crypto.randomUUID()}`, Date.now(), context, userId);
          if (!(await createRideDraftIfQueueEmpty(next))) {
            setErrorMessage('이미 진행 중인 주행이 있습니다.');
            refreshLocal();
            return;
          }
          try {
            await startBackgroundRideLocation();
          } catch (error) {
            await discardRideDraft(next.clientRideId);
            throw error;
          }
          setMessage('주행 기록 중입니다. 화면을 잠가도 로컬에 계속 저장합니다.');
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : UNKNOWN_RIDE_ERROR_MESSAGE);
        } finally {
          refreshLocal();
          setActionBusy(false);
        }
      });
    } finally {
      startInFlight.current = false;
    }
  }, [accessToken, lifecycleGate, refreshLocal, userId]);

  const togglePause = useCallback(async () => lifecycleGate.run(async () => {
    const active = loadActiveRideDraft(userId);
    if (active !== null) {
      setActionBusy(true);
      setErrorMessage(null);
      try {
        const next = await pauseOrResumeRide(active, RIDE_LIFECYCLE_DEPENDENCIES);
        setMessage(next.status === 'PAUSED' ? '주행 기록을 일시정지했습니다.' : '주행 기록을 다시 시작했습니다.');
        refreshLocal();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : UNKNOWN_RIDE_ERROR_MESSAGE);
        refreshLocal();
      } finally {
        setActionBusy(false);
      }
    }
  }), [lifecycleGate, refreshLocal, userId]);

  const finish = useCallback(async () => lifecycleGate.run(async () => {
    const active = loadActiveRideDraft(userId);
    if (active === null) {
      return;
    }
    const finishRequestedAtMs = Date.now();
    if (rideElapsedMs(active, finishRequestedAtMs) < 10_000) {
      setErrorMessage('10초 이상 주행한 뒤 종료해 주세요.');
      return;
    }
    setActionBusy(true);
    setErrorMessage(null);
    try {
      const result = await queueRideForUpload(active, RIDE_LIFECYCLE_DEPENDENCIES);
      refreshLocal();
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
      setActionBusy(false);
    }
  }), [lifecycleGate, refreshLocal, userId]);

  const retry = useCallback(async () => {
    if (draft !== null) {
      await syncById(draft.clientRideId);
    }
  }, [draft, syncById]);

  const retryById = useCallback(async (clientRideId: string) => {
    await syncById(clientRideId);
  }, [syncById]);

  return {
    draft,
    pendingDrafts,
    receipt,
    authenticated: accessToken !== null,
    nowMs,
    busy,
    message,
    errorMessage,
    elapsedMs,
    start,
    togglePause,
    finish,
    retry,
    retryById,
  };
}

const UNKNOWN_RIDE_ERROR_MESSAGE = '주행 처리 중 알 수 없는 오류가 발생했습니다.';

function activeRideConflictMessage(active: RideDraft, userId: number): string {
  if (active.ownerUserId === userId) {
    return '이미 진행 중인 주행이 있습니다.';
  }
  if (active.ownerUserId === null) {
    return '이전 버전에서 기록한 주행이 남아 있습니다. 기록 탭에서 원본을 보존한 뒤 새 주행을 시작해 주세요.';
  }
  return '다른 계정에서 진행 중인 주행이 있습니다. 해당 계정으로 로그인해 먼저 종료해 주세요.';
}
