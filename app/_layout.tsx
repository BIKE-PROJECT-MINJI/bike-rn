import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { registerAuthRideTransitionHandler } from '../src/domain/auth/authRideBoundary';
import '../src/domain/ride/backgroundRideLocation';
import { RideSyncProvider } from '../src/domain/ride/RideSyncContext';
import { pauseRecordingRideForAuthTransition } from '../src/domain/ride/rideAuthTransition';
import { GajaColors } from '../src/shared/design/tokens';

registerAuthRideTransitionHandler(pauseRecordingRideForAuthTransition);

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <RideSyncProvider>
        <SafeAreaProvider>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: GajaColors.background },
              headerTintColor: GajaColors.textPrimary,
              contentStyle: { backgroundColor: GajaColors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="pre-ride/[courseId]" options={{ title: '출발 확인' }} />
            <Stack.Screen name="ai-route/create" options={{ title: 'AI 코스 만들기' }} />
            <Stack.Screen name="ride/free" options={{ headerShown: false }} />
          </Stack>
        </SafeAreaProvider>
      </RideSyncProvider>
    </QueryClientProvider>
  );
}
