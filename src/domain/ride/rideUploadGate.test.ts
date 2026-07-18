import { createRideUploadGate } from './rideUploadGate';

describe('ride upload gate', () => {
  it('starts only one queued ride POST at a time', async () => {
    // Given
    const gate = createRideUploadGate();
    let releaseFirst = (): void => {
      throw new Error('첫 번째 업로드 해제 함수가 준비되지 않았습니다.');
    };
    const firstOperation = jest.fn(() => new Promise<void>((resolve) => {
      releaseFirst = resolve;
    }));
    const secondOperation = jest.fn(async () => undefined);

    // When
    const first = gate.run(firstOperation);
    const second = gate.run(secondOperation);
    await Promise.resolve();

    // Then
    expect(firstOperation).toHaveBeenCalledTimes(1);
    expect(secondOperation).not.toHaveBeenCalled();
    releaseFirst();
    await Promise.all([first, second]);
    expect(secondOperation).toHaveBeenCalledTimes(1);
  });
});
