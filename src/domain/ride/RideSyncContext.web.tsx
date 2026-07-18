import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { RideSyncCoordinatorState } from './RideSyncContext';

const WebRideSyncContext = createContext<RideSyncCoordinatorState | null>(null);

export function RideSyncProvider({ children }: { readonly children: ReactNode }) {
  const [message, setMessage] = useState('주행 실기기 기록은 Android 빌드에서 사용합니다.');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const value = useMemo<RideSyncCoordinatorState>(() => ({
    accessToken: null,
    userId: null,
    draft: null,
    pendingDrafts: [],
    receipt: null,
    legacyRecovery: { activeDraftCount: 0, receiptCount: 0, totalCount: 0 },
    syncing: false,
    message,
    errorMessage,
    refreshLocal: () => undefined,
    syncById: async () => undefined,
    quarantineLegacyRides: async () => undefined,
    setMessage,
    setErrorMessage,
  }), [errorMessage, message]);
  return <WebRideSyncContext.Provider value={value}>{children}</WebRideSyncContext.Provider>;
}

export function useRideSyncCoordinator(): RideSyncCoordinatorState {
  const context = useContext(WebRideSyncContext);
  if (context === null) {
    throw new MissingWebRideSyncProviderError();
  }
  return context;
}

class MissingWebRideSyncProviderError extends Error {
  constructor() {
    super('RideSyncProvider가 앱 루트에 필요합니다.');
    this.name = 'MissingWebRideSyncProviderError';
  }
}
