import { Stack } from 'expo-router';
import { DesignPreview } from '../src/features/designPreview/DesignPreview';

export default function DesignPreviewRoute() {
  return <><Stack.Screen options={{ headerShown: false }} /><DesignPreview /></>;
}
