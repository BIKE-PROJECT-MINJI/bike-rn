import { useLocalSearchParams } from 'expo-router';
import { PreRideScreen } from '../../src/features/preRide/PreRideScreen';

export default function PreRideRoute() {
  const params = useLocalSearchParams<{ courseId?: string }>();
  return <PreRideScreen courseId={Number(params.courseId ?? 0)} />;
}
