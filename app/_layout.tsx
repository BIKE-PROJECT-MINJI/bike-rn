import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GajaColors } from '../src/shared/design/tokens';

export default function RootLayout() {
  const queryClient = useMemo(() => new QueryClient(), []);

  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
