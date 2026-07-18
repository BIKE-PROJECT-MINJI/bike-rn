import { Redirect } from 'expo-router';
import { ApiTestScreen } from '../../src/features/test/ApiTestScreen';

export default function TestRoute() {
  if (!__DEV__) {
    return <Redirect href="/(tabs)" />;
  }
  return <ApiTestScreen />;
}
