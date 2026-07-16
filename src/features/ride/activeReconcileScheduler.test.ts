import type { AppStateStatus } from 'react-native';
import {
  createActiveReconcileScheduler,
  createActiveRideRecoveryMessageGate,
} from './activeReconcileScheduler';

describe('active reconcile scheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancels a pending recovery after the app returns to background', () => {
    let currentState: AppStateStatus = 'active';
    const reconcile = jest.fn(async () => undefined);
    const scheduler = createActiveReconcileScheduler(reconcile, () => currentState);

    scheduler.onAppStateChange('active');
    currentState = 'background';
    scheduler.onAppStateChange('background');
    jest.advanceTimersByTime(250);

    expect(reconcile).not.toHaveBeenCalled();
    scheduler.dispose();
  });

  it('runs one recovery when the app remains active', () => {
    const reconcile = jest.fn(async () => undefined);
    const scheduler = createActiveReconcileScheduler(reconcile, () => 'active');

    scheduler.onAppStateChange('active');
    scheduler.onAppStateChange('active');
    jest.advanceTimersByTime(250);

    expect(reconcile).toHaveBeenCalledTimes(1);
    scheduler.dispose();
  });

  it('does not label a ride created after mount as recovered', () => {
    const gate = createActiveRideRecoveryMessageGate(null);

    const message = gate.messageFor({ clientRideId: 'fresh-ride', status: 'RECORDING' });

    expect(message).toBeNull();
  });

  it('announces the active ride found at mount exactly once', () => {
    const gate = createActiveRideRecoveryMessageGate('restored-ride');

    const first = gate.messageFor({ clientRideId: 'restored-ride', status: 'RECORDING' });
    const second = gate.messageFor({ clientRideId: 'restored-ride', status: 'RECORDING' });

    expect(first).toBe('중단됐던 주행을 복구했습니다. 위치 수집 재연결을 요청했고 새 위치를 확인 중입니다.');
    expect(second).toBeNull();
  });

  it('uses the paused recovery message for a paused ride found at mount', () => {
    const gate = createActiveRideRecoveryMessageGate('paused-ride');

    const message = gate.messageFor({ clientRideId: 'paused-ride', status: 'PAUSED' });

    expect(message).toBe('일시정지된 주행을 복구했습니다.');
  });
});
