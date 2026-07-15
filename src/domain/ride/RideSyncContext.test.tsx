import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';
import type { AuthSession } from '../auth/authModels';
import { createRideDraft, finishRideDraft } from './rideQueueModel';
import type { RidePendingSyncState } from './useRidePendingSync';

const mockPendingDrafts = [
  finishRideDraft(createRideDraft('ride-pending', 1_700_000_000_000), 1_700_000_060_000),
];
let mockActiveCoordinatorCount = 0;
let mockMaxCoordinatorCount = 0;

const mockUseRidePendingSync = jest.fn((_accessToken: string | null): RidePendingSyncState => {
  useEffect(() => {
    mockActiveCoordinatorCount += 1;
    mockMaxCoordinatorCount = Math.max(mockMaxCoordinatorCount, mockActiveCoordinatorCount);
    return () => {
      mockActiveCoordinatorCount -= 1;
    };
  }, []);
  return {
    draft: mockPendingDrafts[0] ?? null,
    pendingDrafts: mockPendingDrafts,
    receipt: null,
    syncing: false,
    refreshLocal: jest.fn(),
    syncById: jest.fn(async () => undefined),
  };
});

jest.mock('../auth/authSessionStore', () => ({
  loadAuthSession: jest.fn(async (): Promise<AuthSession> => ({
    userId: 42,
    email: 'qa@example.com',
    displayName: 'QA',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accessTokenExpiresAtEpochMillis: 1_700_003_600_000,
    refreshTokenExpiresAtEpochMillis: 1_700_604_800_000,
  })),
}));
jest.mock('./useRidePendingSync', () => ({ useRidePendingSync: mockUseRidePendingSync }));

const { RideSyncProvider, useRideSyncCoordinator } =
  require('./RideSyncContext') as typeof import('./RideSyncContext');

describe('RideSyncProvider', () => {
  beforeEach(() => {
    mockActiveCoordinatorCount = 0;
    mockMaxCoordinatorCount = 0;
    mockUseRidePendingSync.mockClear();
  });

  it('mounts one coordinator and shares its pending state with every consumer and query cache', async () => {
    // Given
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

    // When
    const view = render(
      <QueryClientProvider client={queryClient}>
        <RideSyncProvider>
          <CoordinatorProbe testId="probe-a" />
          <CoordinatorProbe testId="probe-b" />
        </RideSyncProvider>
      </QueryClientProvider>,
    );

    // Then
    await waitFor(() => expect(screen.getByTestId('probe-a')).toHaveTextContent('access-token:1'));
    expect(screen.getByTestId('probe-b')).toHaveTextContent('access-token:1');
    expect(mockMaxCoordinatorCount).toBe(1);
    expect(queryClient.getQueryData(['pending-rides-home'])).toBe(mockPendingDrafts);
    expect(queryClient.getQueryData(['pending-rides-records'])).toBe(mockPendingDrafts);
    view.unmount();
    queryClient.clear();
  }, 30_000);
});

function CoordinatorProbe({ testId }: { readonly testId: string }) {
  const coordinator = useRideSyncCoordinator();
  return <Text testID={testId}>{`${coordinator.accessToken ?? 'none'}:${coordinator.pendingDrafts.length}`}</Text>;
}
