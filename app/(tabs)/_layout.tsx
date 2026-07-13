import { Tabs } from 'expo-router';
import { GajaColors } from '../../src/shared/design/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: GajaColors.background },
        headerTintColor: GajaColors.textPrimary,
        tabBarActiveTintColor: GajaColors.primary,
        tabBarInactiveTintColor: GajaColors.textMuted,
        tabBarStyle: { backgroundColor: GajaColors.surface },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '홈', tabBarLabel: '홈' }} />
      <Tabs.Screen name="courses" options={{ title: '코스', tabBarLabel: '코스' }} />
      <Tabs.Screen name="test" options={{ title: '기능 테스트', tabBarLabel: '테스트' }} />
      <Tabs.Screen name="profile" options={{ title: '내 정보', tabBarLabel: '내 정보' }} />
    </Tabs>
  );
}
