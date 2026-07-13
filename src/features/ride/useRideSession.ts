import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useState } from 'react';
import {
  captureCurrentRideLocation,
  requestRideLocationPermissions,
  startBackgroundRideLocation,
  stopBackgroundRideLocation,
} from '../../domain/ride/backgroundRideLocation';
import { fetchRideStatus, uploadRideDraft } from '../../domain/ride/rideApi';
import {
  completeRideDraft,
  discardRideDraft,
  listPendingRideDrafts,
  loadActiveRideDraft,
  loadLatestRideReceipt,
  loadRideDraft,
  saveRideDraft,
  updateRideDraft,
} from '../../domain/ride/localRideQueue';
import {
  createRideDraft,
  finishRideDraft,
  pauseRideDraft,
  resumeRideDraft,
  rideElapsedMs,
  type RideDraft,
  type RideReceipt,
} from '../../domain/ride/rideQueueModel';
import { syncRideDraft, type RideSyncResult } from '../../domain/ride/rideSyncEngine';
import { createRideSyncGate } from '../../domain/ride/rideSyncGate';

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

  useEffect(() => {
    const reconcile = async () => {
      const active = loadActiveRideDraft();
      if (active === null) {
        return;
      }
      try {
        if (active.status === 'RECORDING') {
          await startBackgroundRideLocation();
          setMessage('중단됐던 주행을 복구하고 위치 수집을 다시 연결했습니다.');
        } else {
          await stopBackgroundRideLocation();
          setMessage('일시정지된 주행을 복구했습니다.');
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : '저장된 주행의 위치 수집을 다시 연결하지 못했습니다.',
        );
      } finally {
        refreshLocal();
      }
    };
    void reconcile();
  }, [refreshLocal]);

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
      await saveRideDraft(next);
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
  }, [accessToken, refreshLocal]);

  const togglePause = useCallback(async () => {
    const active = loadActiveRideDraft();
    if (active === null) {
      return;
    }
    let next: RideDraft | null;
    if (active.status === 'RECORDING') {
      await stopBackgroundRideLocation();
      next = await updateRideDraft(active.clientRideId, (latest) => pauseRideDraft(latest, Date.now()));
    } else {
      await startBackgroundRideLocation();
      next = await updateRideDraft(active.clientRideId, (latest) => resumeRideDraft(latest, Date.now()));
    }
    if (next === null) {
      return;
    }
    setDraft(next);
    setMessage(next.status === 'PAUSED' ? '주행 기록을 일시정지했습니다.' : '주행 기록을 다시 시작했습니다.');
  }, []);

  const finish = useCallback(async () => {
    const active = loadActiveRideDraft();
    if (active === null) {
      return;
    }
    const finishRequestedAtMs = Date.now();
    if (rideElapsedMs(active, finishRequestedAtMs) < 10_000 || active.routePoints.length === 0) {
      setErrorMessage('10초 이상 주행하고 GPS 포인트가 수집된 뒤 종료해 주세요.');
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      let finalCaptureFailed = false;
      try {
        await captureCurrentRideLocation(active.clientRideId);
      } catch (error) {
        finalCaptureFailed = true;
        setErrorMessage(
          error instanceof Error ? `마지막 위치 확인 실패: ${error.message}` : '마지막 위치를 확인하지 못했습니다.',
        );
      }
      await stopBackgroundRideLocation();
      const endedAtMs = Date.now();
      const queued = await updateRideDraft(active.clientRideId, (latest) => finishRideDraft(latest, endedAtMs));
      if (queued === null) {
        throw new MissingLocalRideError();
      }
      setDraft(queued);
      setMessage(
        finalCaptureFailed
          ? '주행은 로컬에 보존했습니다. 마지막 위치 확인 경고와 함께 서버 저장을 시작합니다.'
          : '주행을 로컬에 보존했습니다. 서버 저장을 시작합니다.',
      );
      await syncById(queued.clientRideId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : UNKNOWN_RIDE_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }, [syncById]);

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

class MissingLocalRideError extends Error {
  constructor() {
    super('로컬에서 저장 중인 주행을 찾을 수 없습니다.');
    this.name = 'MissingLocalRideError';
  }
}
