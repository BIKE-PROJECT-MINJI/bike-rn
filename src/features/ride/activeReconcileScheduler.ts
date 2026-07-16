import type { AppStateStatus } from 'react-native';

export type ActiveReconcileScheduler = {
  readonly onAppStateChange: (nextState: AppStateStatus) => void;
  readonly dispose: () => void;
};

type ActiveRideState = {
  readonly clientRideId: string;
  readonly status: 'RECORDING' | 'PAUSED';
};

export type ActiveRideRecoveryMessageGate = {
  readonly messageFor: (active: ActiveRideState | null) => string | null;
};

export function createActiveRideRecoveryMessageGate(
  initialActiveRideId: string | null,
): ActiveRideRecoveryMessageGate {
  let pendingActiveRideId = initialActiveRideId;
  return {
    messageFor(active) {
      if (active === null || active.clientRideId !== pendingActiveRideId) {
        return null;
      }
      if (active.status === 'RECORDING') {
        pendingActiveRideId = null;
        return '중단됐던 주행을 복구했습니다. 위치 수집 재연결을 요청했고 새 위치를 확인 중입니다.';
      }
      if (active.status === 'PAUSED') {
        pendingActiveRideId = null;
        return '일시정지된 주행을 복구했습니다.';
      }
      return null;
    },
  };
}

export function createActiveReconcileScheduler(
  reconcile: () => Promise<void>,
  getCurrentState: () => AppStateStatus,
): ActiveReconcileScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  const onAppStateChange = (nextState: AppStateStatus): void => {
    cancel();
    if (nextState !== 'active') {
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      if (getCurrentState() === 'active') {
        void reconcile();
      }
    }, 250);
  };
  return { onAppStateChange, dispose: cancel };
}
