import { fireEvent, render } from '@testing-library/react-native';
import { RideEndConfirmation } from './RideEndConfirmation';
import { RideHudDock } from './RideHudDock';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

describe('RideHudDock', () => {
  it('대기 상태에서 자유주행 시작 명령을 제공한다', () => {
    const onStart = jest.fn();
    const screen = render(
      <RideHudDock
        active={false}
        bottomInset={0}
        busy={false}
        distance="0 m"
        duration="00:00"
        onEnd={jest.fn()}
        onStart={onStart}
        onTogglePause={jest.fn()}
        paused={false}
        speedKmh={0}
        startLabel="자유주행 시작"
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: '자유주행 시작' }));

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('진행 중에는 일시정지와 종료 명령을 분리한다', () => {
    const onTogglePause = jest.fn();
    const onEnd = jest.fn();
    const screen = render(
      <RideHudDock
        active
        bottomInset={0}
        busy={false}
        distance="4.3 km"
        duration="28:14"
        onEnd={onEnd}
        onStart={jest.fn()}
        onTogglePause={onTogglePause}
        paused={false}
        speedKmh={15.4}
        startLabel="자유주행 시작"
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: '주행 일시정지' }));
    fireEvent.press(screen.getByRole('button', { name: '주행 종료' }));

    expect(onTogglePause).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(screen.getByText('15.4')).toBeTruthy();
  });
});

describe('RideEndConfirmation', () => {
  it('명시적인 종료 및 저장 확인에서만 종료 액션을 호출한다', () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    const screen = render(
      <RideEndConfirmation busy={false} onCancel={onCancel} onConfirm={onConfirm} visible />,
    );

    fireEvent.press(screen.getByRole('button', { name: '계속 주행' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: '종료 및 저장' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
