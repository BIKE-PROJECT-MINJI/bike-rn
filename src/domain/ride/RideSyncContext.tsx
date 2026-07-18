import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadAuthSession, subscribeAuthSessionChanges } from '../auth/authSessionStore';
import { useRidePendingSync, type RidePendingSyncState } from './useRidePendingSync';

export type RideSyncCoordinatorState = RidePendingSyncState & {
  readonly accessToken: string | null;
  readonly userId: number | null;
  readonly message: string;
  readonly errorMessage: string | null;
  readonly setMessage: (message: string) => void;
  readonly setErrorMessage: (message: string | null) => void;
};

const RideSyncContext = createContext<RideSyncCoordinatorState | null>(null);

export function RideSyncProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({ queryKey: ['auth-session'], queryFn: loadAuthSession });
  const accessToken = sessionQuery.data?.accessToken ?? null;
  const userId = sessionQuery.data?.userId ?? null;
  const [message, setMessage] = useState('주행을 시작할 준비가 됐습니다.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pendingSync = useRidePendingSync(accessToken, setMessage, setErrorMessage, userId);

  useEffect(() => subscribeAuthSessionChanges(() => {
    void queryClient.invalidateQueries({ queryKey: ['auth-session'] });
  }), [queryClient]);

  useEffect(() => {
    queryClient.setQueryData(['pending-rides-home', userId], pendingSync.pendingDrafts);
    queryClient.setQueryData(['pending-rides-records', userId], pendingSync.pendingDrafts);
  }, [pendingSync.pendingDrafts, queryClient, userId]);

  const value = useMemo<RideSyncCoordinatorState>(() => ({
    ...pendingSync,
    accessToken,
    userId,
    message,
    errorMessage,
    setMessage,
    setErrorMessage,
  }), [accessToken, errorMessage, message, pendingSync, userId]);

  return <RideSyncContext.Provider value={value}>{children}</RideSyncContext.Provider>;
}

export function useRideSyncCoordinator(): RideSyncCoordinatorState {
  const context = useContext(RideSyncContext);
  if (context === null) {
    throw new MissingRideSyncProviderError();
  }
  return context;
}

class MissingRideSyncProviderError extends Error {
  constructor() {
    super('RideSyncProvider가 앱 루트에 필요합니다.');
    this.name = 'MissingRideSyncProviderError';
  }
}
