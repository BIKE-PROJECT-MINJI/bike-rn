import type { AppStateStatus } from 'react-native';

export type ActiveReconcileScheduler = {
  readonly onAppStateChange: (nextState: AppStateStatus) => void;
  readonly dispose: () => void;
};

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
