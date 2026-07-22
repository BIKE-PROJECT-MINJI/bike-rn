import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AiRouteCreateScreen } from './AiRouteCreateScreen';
import { searchAddress } from '../../domain/address/addressService';

jest.mock('../../domain/address/addressService', () => ({ searchAddress: jest.fn() }));
jest.mock('../../domain/auth/authSessionStore', () => ({
  loadAuthSession: jest.fn(async () => ({ accessToken: 'test-access-token' })),
}));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../shared/ui/RoutePreviewMap', () => ({ RoutePreviewMap: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));

const searchAddressMock = jest.mocked(searchAddress);

describe('AiRouteCreateScreen address search', () => {
  beforeEach(() => {
    searchAddressMock.mockReset();
  });

  it('renders both AMBIGUOUS candidates and changes the destination selection state', async () => {
    searchAddressMock.mockResolvedValue({
      status: 'AMBIGUOUS',
      uiState: 'success',
      statusText: '비슷한 후보가 여러 개 있습니다.',
      provider: 'FAKE_ADDRESS',
      primaryProvider: 'FAKE_ADDRESS',
      fallbackUsed: false,
      fallbackReason: null,
      candidates: [
        { label: '테스트 후보 A', address: '테스트 구역 A', lat: 1, lon: 2 },
        { label: '테스트 후보 B', address: '테스트 구역 B', lat: 3, lon: 4 },
      ],
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });

    const view = render(
      <QueryClientProvider client={queryClient}>
        <AiRouteCreateScreen />
      </QueryClientProvider>,
    );

    fireEvent.changeText(screen.getByPlaceholderText('목적지 주소 또는 장소명'), '테스트 검색어');
    await waitFor(() => expect(screen.getByRole('button', { name: '주소 검색' })).toBeEnabled());
    fireEvent.press(screen.getByRole('button', { name: '주소 검색' }));

    await screen.findByText('테스트 후보 A');
    expect(screen.getByText('테스트 후보 B')).toBeTruthy();
    expect(screen.getAllByText('목적지로 선택')).toHaveLength(2);

    fireEvent.press(screen.getByRole('button', { name: '테스트 후보 B, 테스트 구역 B' }));

    expect(screen.getByText('선택됨')).toBeTruthy();
    expect(screen.getAllByText('목적지로 선택')).toHaveLength(1);
    expect(searchAddressMock).toHaveBeenCalledWith('테스트 검색어', 'test-access-token');
    view.unmount();
    queryClient.clear();
  }, 60_000);
});
