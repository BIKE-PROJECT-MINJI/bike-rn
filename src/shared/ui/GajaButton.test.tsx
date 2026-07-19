import { fireEvent, render, screen } from '@testing-library/react-native';
import { GajaButton } from './GajaButton';

describe('GajaButton accessibility', () => {
  it('비활성 버튼의 이름과 disabled 상태를 보조 기술에 제공한다', () => {
    // Given
    const onPress = jest.fn();
    render(<GajaButton disabled label="다시 저장 중" onPress={onPress} />);

    // When
    const button = screen.getByRole('button', { name: '다시 저장 중', disabled: true });
    fireEvent.press(button);

    // Then
    expect(button).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
  });
});
