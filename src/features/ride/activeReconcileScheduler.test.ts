import type { AppStateStatus } from 'react-native';
import { createActiveReconcileScheduler } from './activeReconcileScheduler';

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
});
