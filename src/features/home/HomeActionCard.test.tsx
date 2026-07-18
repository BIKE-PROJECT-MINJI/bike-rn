import { fireEvent, render } from '@testing-library/react-native';
import { HomeActionCard } from './HomeActionCard';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

describe('HomeActionCard', () => {
  it('핵심 행동을 접근 가능한 버튼 하나로 제공한다', () => {
    const onPress = jest.fn();
    const screen = render(
      <HomeActionCard
        title="AI 코스 만들기"
        description="원하는 분위기에 맞는 코스를 찾습니다."
        actionLabel="만들기"
        icon="sparkles"
        accent="green"
        onPress={onPress}
      />,
    );

    const action = screen.getByRole('button', { name: 'AI 코스 만들기, 만들기' });
    fireEvent.press(action);

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('원하는 분위기에 맞는 코스를 찾습니다.')).toBeTruthy();
  });
});
