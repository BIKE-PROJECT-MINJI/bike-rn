import { createRideSyncGate } from './rideSyncGate';

describe('ride sync gate', () => {
  it('shares one in-flight operation for the same clientRideId', async () => {
    const gate = createRideSyncGate();
    let release: () => void = () => {
      throw new Error('동기화 작업이 시작되지 않았습니다.');
    };
    const operation = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const first = gate.run('ride-one', operation);
    const second = gate.run('ride-one', operation);
    release();

    await Promise.all([first, second]);
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
