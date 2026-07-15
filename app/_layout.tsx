import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../src/domain/ride/backgroundRideLocation';
import { RideSyncProvider } from '../src/domain/ride/RideSyncContext';
import { GajaColors } from '../src/shared/design/tokens';

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
            <Stack.Screen name="ride/free" options={{ headerShown: false }} />
          </Stack>
        </SafeAreaProvider>
      </RideSyncProvider>
    </QueryClientProvider>
  );
}
