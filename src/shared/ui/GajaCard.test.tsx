import { fireEvent, render, screen } from '@testing-library/react-native';
import { GajaCard } from './GajaCard';

describe('GajaCard accessibility', () => {
  it('exposes a pressable card as one named button', () => {
    // Given
    const onPress = jest.fn();
    render(<GajaCard title="한강 평지 코스" subtitle="3.2 km, 18분" onPress={onPress} />);

    // When
    fireEvent.press(screen.getByRole('button', { name: '한강 평지 코스, 3.2 km, 18분' }));

    // Then
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
