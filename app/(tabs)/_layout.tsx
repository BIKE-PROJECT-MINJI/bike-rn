import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { GajaColors } from '../../src/shared/design/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: GajaColors.primary,
        tabBarInactiveTintColor: GajaColors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: { backgroundColor: GajaColors.surface, borderTopColor: GajaColors.border, height: 70, paddingTop: 7, paddingBottom: 8 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '홈', tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }} />
      <Tabs.Screen name="courses" options={{ title: '코스', tabBarIcon: ({ color, size }) => <Ionicons name="git-branch" color={color} size={size} /> }} />
      <Tabs.Screen name="records" options={{ title: '기록', tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart" color={color} size={size} /> }} />
      <Tabs.Screen name="party" options={{ title: '파티', tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: '마이', tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} /> }} />
      <Tabs.Screen name="test" options={{ href: null }} />
    </Tabs>
  );
}
